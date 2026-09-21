import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type TranslationResourceType } from "@prisma/client";

import { db } from "@/lib/db";
import { fingerprintSyncValue } from "@/lib/i18n/sync-comparison";
import { metaobjectFieldKey } from "@/lib/shopify/metaobject-field-key";
import {
  contentLocaleForShopify,
  loadReconcileSubject,
  writeLocalReconcileField,
  type ReconcileBindingSource,
} from "@/lib/shopify/reconciliation-source";
import { sourceContentAsRemoteValues, updateShopifySourceField } from "@/lib/shopify/source-content";
import { projectRemoteTranslationWithMetadata } from "@/lib/shopify/translation-reconciliation";
import {
  recordReconcileAuditDetails,
  recordSyncEvent,
  saveTranslationSnapshot,
} from "@/lib/shopify/translation-sync";
import {
  fetchResourceTranslation,
  fetchResourceTranslationState,
  registerTranslations,
} from "@/lib/shopify/translations";

export type ReconcileChoice = "SYNARAVA" | "SHOPIFY";

type ApplyRow = {
  id: string;
  bindingId: string;
  locale: string;
  fieldKey: string;
  localFingerprint: string;
  shopifyFingerprint: string;
  bindingResourceType: TranslationResourceType;
  bindingEntityId: string;
  shopifyResourceId: string;
  lastSyncedSnapshot: unknown;
};

type SnapshotRow = { values: Record<string, unknown> };

export type ReconcileApplyResult = {
  divergenceId: string;
  ok: boolean;
  message: string;
};

async function claimDifference(divergenceId: string, token: string) {
  const rows = await db.$queryRaw<ApplyRow[]>(Prisma.sql`
    UPDATE "ShopifyFieldDivergence" AS difference
    SET
      "resolutionToken" = ${token},
      "resolutionStartedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM "ShopifyTranslationBinding" AS binding
    WHERE
      difference."id" = ${divergenceId}
      AND difference."bindingId" = binding."id"
      AND difference."resolvedAt" IS NULL
      AND (
        difference."resolutionToken" IS NULL
        OR difference."resolutionStartedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
      )
    RETURNING
      difference."id",
      difference."bindingId",
      difference."locale",
      difference."fieldKey",
      difference."localFingerprint",
      difference."shopifyFingerprint",
      binding."resourceType" AS "bindingResourceType",
      binding."entityId" AS "bindingEntityId",
      binding."shopifyResourceId",
      binding."lastSyncedSnapshot"
  `);
  return rows[0] ?? null;
}

async function releaseClaim(divergenceId: string, token: string, resolved: boolean) {
  await db.$executeRaw(Prisma.sql`
    UPDATE "ShopifyFieldDivergence"
    SET
      "resolutionToken" = NULL,
      "resolutionStartedAt" = NULL,
      "resolvedAt" = CASE WHEN ${resolved} THEN CURRENT_TIMESTAMP ELSE "resolvedAt" END,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${divergenceId} AND "resolutionToken" = ${token}
  `);
}

async function snapshotFor(bindingId: string, locale: string, legacy: unknown) {
  const rows = await db.$queryRaw<SnapshotRow[]>(Prisma.sql`
    SELECT "values"
    FROM "ShopifyTranslationSnapshot"
    WHERE "bindingId" = ${bindingId} AND "locale" = ${locale}
    LIMIT 1
  `);
  const fallback = legacy && typeof legacy === "object" && !Array.isArray(legacy)
    ? legacy as Record<string, unknown>
    : {};
  return rows[0]?.values ?? fallback;
}

function bindingFrom(row: ApplyRow): ReconcileBindingSource {
  return {
    id: row.bindingId,
    resourceType: row.bindingResourceType,
    entityId: row.bindingEntityId,
    shopifyResourceId: row.shopifyResourceId,
    lastSyncedSnapshot: row.lastSyncedSnapshot,
  };
}

function shopifyWireValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

async function fetchRemoteValues(resourceId: string, locale: string) {
  if (contentLocaleForShopify(locale) === "en") {
    const state = await fetchResourceTranslationState(resourceId, "pt-PT");
    if (!state) return null;
    return sourceContentAsRemoteValues(state.translatableContent);
  }
  return fetchResourceTranslation(resourceId, locale);
}

export async function applyReconcileChoice({
  divergenceId,
  choice,
  expectedLocalFingerprint,
  expectedShopifyFingerprint,
  actorUsername,
}: {
  divergenceId: string;
  choice: ReconcileChoice;
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
  actorUsername: string;
}): Promise<ReconcileApplyResult> {
  const token = randomUUID();
  const row = await claimDifference(divergenceId, token);
  if (!row) {
    return { divergenceId, ok: false, message: "This change is already being reviewed or has been resolved." };
  }

  const binding = bindingFrom(row);
  const direction: "PUSH" | "PULL" = choice === "SYNARAVA" ? "PUSH" : "PULL";
  try {
    if (row.localFingerprint !== expectedLocalFingerprint || row.shopifyFingerprint !== expectedShopifyFingerprint) {
      throw new Error("The review is stale. Check Shopify again before applying changes.");
    }

    const contentLocale = contentLocaleForShopify(row.locale);
    const subject = await loadReconcileSubject(binding, row.locale);
    if (!subject) throw new Error("The local translation no longer exists.");
    const field = subject.registry.fields.find((candidate) => candidate.key === row.fieldKey);
    if (!field?.shopifyTarget) throw new Error("This translated field is no longer supported.");

    const translations = await fetchRemoteValues(row.shopifyResourceId, row.locale);
    if (!translations) throw new Error("Shopify no longer exposes this resource as translatable.");
    const remote = projectRemoteTranslationWithMetadata(subject.registry, translations);
    const currentLocalValue = subject.local[row.fieldKey] ?? null;
    const currentShopifyValue = remote.values[row.fieldKey] ?? null;
    const currentLocalFingerprint = fingerprintSyncValue(field, currentLocalValue);
    const currentShopifyFingerprint = fingerprintSyncValue(field, currentShopifyValue);

    if (currentLocalFingerprint !== expectedLocalFingerprint || currentShopifyFingerprint !== expectedShopifyFingerprint) {
      throw new Error("Synarava or Shopify changed after this review. Check again before applying.");
    }

    let appliedValue: unknown;
    let shopifyResponse: Record<string, unknown> | null = null;
    if (choice === "SYNARAVA") {
      const shopifyKey = field.shopifyTarget.kind === "metaobject"
        ? metaobjectFieldKey(field.shopifyTarget.key)
        : field.shopifyTarget.key;
      const writeResult = contentLocale === "en"
        ? await updateShopifySourceField({
            resourceType: row.bindingResourceType,
            resourceId: row.shopifyResourceId,
            field,
            value: currentLocalValue,
          })
        : await registerTranslations({
            resourceId: row.shopifyResourceId,
            locale: row.locale,
            values: { [shopifyKey]: shopifyWireValue(currentLocalValue) },
          });
      const verifiedTranslations = await fetchRemoteValues(row.shopifyResourceId, row.locale);
      if (!verifiedTranslations) throw new Error("Shopify did not return the translated resource after writing.");
      const verifiedRemote = projectRemoteTranslationWithMetadata(subject.registry, verifiedTranslations);
      if (fingerprintSyncValue(field, verifiedRemote.values[row.fieldKey] ?? null) !== currentLocalFingerprint) {
        throw new Error("Shopify accepted the request but the read-back value did not match. Nothing is marked resolved.");
      }
      shopifyResponse = {
        writeResult,
        verifiedUpdatedAt: verifiedRemote.metadata[row.fieldKey]?.updatedAt ?? null,
        verifiedOutdated: verifiedRemote.metadata[row.fieldKey]?.outdated ?? null,
      };
      appliedValue = currentLocalValue;
    } else {
      appliedValue = await writeLocalReconcileField({
        binding,
        locale: row.locale,
        fieldKey: row.fieldKey,
        shopifyValue: currentShopifyValue,
      });
      const verifiedLocal = await loadReconcileSubject(binding, row.locale);
      const verifiedField = verifiedLocal?.registry.fields.find((candidate) => candidate.key === row.fieldKey);
      if (!verifiedLocal || !verifiedField
        || fingerprintSyncValue(verifiedField, verifiedLocal.local[row.fieldKey] ?? null) !== currentShopifyFingerprint) {
        throw new Error("The local update could not be verified. Nothing is marked resolved.");
      }
      shopifyResponse = {
        readUpdatedAt: remote.metadata[row.fieldKey]?.updatedAt ?? null,
        readOutdated: remote.metadata[row.fieldKey]?.outdated ?? null,
      };
    }

    const snapshot = await snapshotFor(row.bindingId, row.locale, row.lastSyncedSnapshot);
    await saveTranslationSnapshot({
      bindingId: row.bindingId,
      locale: row.locale,
      values: { ...snapshot, [row.fieldKey]: appliedValue },
    });
    const event = await recordSyncEvent({
      bindingId: row.bindingId,
      locale: contentLocale,
      direction,
      status: "SUCCEEDED",
      actorUsername,
    });
    await recordReconcileAuditDetails({
      eventId: event.id,
      scope: {
        divergenceId,
        bindingId: row.bindingId,
        fieldKey: row.fieldKey,
        locale: row.locale,
      },
      selectedSide: choice,
      localFingerprint: currentLocalFingerprint,
      shopifyFingerprint: currentShopifyFingerprint,
      resultFingerprint: fingerprintSyncValue(field, appliedValue),
      shopifyResponse,
    });
    await releaseClaim(divergenceId, token, true);
    return {
      divergenceId,
      ok: true,
      message: choice === "SYNARAVA" ? "Synarava was applied to Shopify." : "Shopify was applied to Synarava.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "This change could not be applied.";
    await releaseClaim(divergenceId, token, false).catch(() => undefined);
    try {
      const event = await recordSyncEvent({
        bindingId: row.bindingId,
        locale: contentLocaleForShopify(row.locale),
        direction,
        status: "FAILED",
        error: message,
        actorUsername,
      });
      await recordReconcileAuditDetails({
        eventId: event.id,
        scope: {
          divergenceId,
          bindingId: row.bindingId,
          fieldKey: row.fieldKey,
          locale: row.locale,
        },
        selectedSide: choice,
        localFingerprint: row.localFingerprint,
        shopifyFingerprint: row.shopifyFingerprint,
        resultFingerprint: null,
        shopifyResponse: null,
      });
    } catch {
      // Applying the guard/result remains authoritative even if the audit
      // enrichment itself is temporarily unavailable.
    }
    return { divergenceId, ok: false, message };
  }
}
