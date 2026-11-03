import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type TranslationResourceType } from "@prisma/client";

import { db } from "@/lib/db";
import { fingerprintSyncValue } from "@/lib/i18n/sync-comparison";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
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
} from "@/lib/shopify/translation-sync";
import {
  fetchResourceTranslation,
  fetchResourceTranslationState,
  registerTranslations,
} from "@/lib/shopify/translations";

export type ReconcileChoice = "SYNARAVA" | "SHOPIFY";

export type ReconcileEntityAddress = {
  rootEntityType: "PRODUCT" | "COLLECTION"; rootEntityId: string; locale: string; fieldKey: string;
};

type ApplyRow = {
  id: string; bindingId: string; locale: string; fieldKey: string;
  localFingerprint: string; shopifyFingerprint: string;
  bindingResourceType: TranslationResourceType; bindingEntityId: string; shopifyResourceId: string;
};

export type ReconcileApplyResult = {
  divergenceId: string | null;
  ok: boolean;
  message: string;
};

const MSG = {
  held: "This change is currently being applied by another attempt.",
  closed: "This change has already been resolved.",
  missing: "This change is no longer present.", already: "Already applied.",
} as const;

/** `translation:{shopifyLocale}:{registryFieldKey}` — fieldKey may contain `:`. */
export function parseTranslationConflictFieldKey(
  conflictFieldKey: string,
): { locale: string; fieldKey: string } | null {
  if (!conflictFieldKey.startsWith("translation:")) return null;
  const rest = conflictFieldKey.slice("translation:".length);
  const sep = rest.indexOf(":");
  if (sep <= 0 || sep === rest.length - 1) return null;
  return { locale: rest.slice(0, sep), fieldKey: rest.slice(sep + 1) };
}

/** Newest open row for entity+locale+fieldKey (LIMIT 1). Never a frozen random id. */
async function claimDifference(address: ReconcileEntityAddress, token: string) {
  const rows = await db.$queryRaw<ApplyRow[]>(Prisma.sql`
    UPDATE "ShopifyFieldDivergence" AS difference
    SET
      "resolutionToken" = ${token},
      "resolutionStartedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM "ShopifyTranslationBinding" AS binding
    WHERE
      difference."id" = (
        SELECT candidate."id"
        FROM "ShopifyFieldDivergence" AS candidate
        WHERE
          candidate."rootEntityType" = ${address.rootEntityType}
          AND candidate."rootEntityId" = ${address.rootEntityId}
          AND candidate."locale" = ${address.locale}
          AND candidate."fieldKey" = ${address.fieldKey}
          AND candidate."resolvedAt" IS NULL
          AND (
            candidate."resolutionToken" IS NULL
            OR candidate."resolutionStartedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
          )
        ORDER BY candidate."createdAt" DESC
        LIMIT 1
      )
      AND difference."bindingId" = binding."id"
    RETURNING
      difference."id", difference."bindingId", difference."locale", difference."fieldKey",
      difference."localFingerprint", difference."shopifyFingerprint",
      binding."resourceType" AS "bindingResourceType",
      binding."entityId" AS "bindingEntityId", binding."shopifyResourceId"
  `);
  return rows[0] ?? null;
}

async function releaseClaim(divergenceId: string, token: string, resolved: boolean) {
  await db.shopifyFieldDivergence.updateMany({
    where: { id: divergenceId, resolutionToken: token },
    data: { resolutionToken: null, resolutionStartedAt: null, ...(resolved ? { resolvedAt: new Date() } : {}) },
  });
}

async function classifyFailedClaim(
  address: ReconcileEntityAddress,
  expectedLocalFingerprint: string,
  expectedShopifyFingerprint: string,
): Promise<ReconcileApplyResult> {
  const latest = await db.shopifyFieldDivergence.findFirst({
    where: {
      rootEntityType: address.rootEntityType,
      rootEntityId: address.rootEntityId,
      locale: address.locale,
      fieldKey: address.fieldKey,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, localFingerprint: true, shopifyFingerprint: true,
      resolvedAt: true, resolutionToken: true, resolutionStartedAt: true,
    },
  });
  if (!latest) return { divergenceId: null, ok: false, message: MSG.missing };
  const held = latest.resolvedAt == null && latest.resolutionToken && latest.resolutionStartedAt
    && Date.now() - latest.resolutionStartedAt.getTime() < 5 * 60 * 1000;
  if (held) return { divergenceId: latest.id, ok: false, message: MSG.held };
  if (latest.resolvedAt != null) {
    const same = latest.localFingerprint === expectedLocalFingerprint
      && latest.shopifyFingerprint === expectedShopifyFingerprint;
    return { divergenceId: latest.id, ok: same, message: same ? MSG.already : MSG.closed };
  }
  return { divergenceId: latest.id, ok: false, message: MSG.missing };
}

function bindingFrom(row: ApplyRow): ReconcileBindingSource {
  return {
    id: row.bindingId,
    resourceType: row.bindingResourceType,
    entityId: row.bindingEntityId,
    shopifyResourceId: row.shopifyResourceId,
  };
}

function shopifyWireValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

async function fetchRemoteValues(resourceId: string, locale: string) {
  if (await contentLocaleForShopify(locale) === "en") {
    const [anyTranslationLocale] = (await getPublishedStorefrontLocales()).filter((item) => !item.isDefault);
    if (!anyTranslationLocale) {
      throw new Error("No published translation locale is registered to read Shopify's source content through.");
    }
    const state = await fetchResourceTranslationState(resourceId, anyTranslationLocale.shopifyLocale);
    if (!state) return null;
    return sourceContentAsRemoteValues(state.translatableContent);
  }
  return fetchResourceTranslation(resourceId, locale);
}

export async function applyReconcileChoice({
  rootEntityType,
  rootEntityId,
  locale,
  fieldKey,
  choice,
  expectedLocalFingerprint,
  expectedShopifyFingerprint,
  actorUsername,
}: ReconcileEntityAddress & {
  choice: ReconcileChoice;
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
  actorUsername: string;
}): Promise<ReconcileApplyResult> {
  const address: ReconcileEntityAddress = { rootEntityType, rootEntityId, locale, fieldKey };
  const token = randomUUID();
  const row = await claimDifference(address, token);
  if (!row) {
    return classifyFailedClaim(address, expectedLocalFingerprint, expectedShopifyFingerprint);
  }

  const binding = bindingFrom(row);
  const direction: "PUSH" | "PULL" = choice === "SYNARAVA" ? "PUSH" : "PULL";
  let released = false;
  const release = async (resolved: boolean) => {
    if (released) return;
    await releaseClaim(row.id, token, resolved);
    released = true;
  };
  try {
    if (row.localFingerprint !== expectedLocalFingerprint || row.shopifyFingerprint !== expectedShopifyFingerprint) {
      throw new Error("The review is stale. Check Shopify again before applying changes.");
    }

    const contentLocale = await contentLocaleForShopify(row.locale);
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

    if (contentLocale === "en" && row.bindingResourceType === "PRODUCT" && field.shopifyTarget.kind === "native") {
      const paths: Record<string, string> = {
        title: "title", handle: "handle", body_html: "descriptionHtml",
        meta_title: "seo.title", meta_description: "seo.description",
      };
      const path = paths[field.shopifyTarget.key];
      if (path) {
        const { adoptShopifyProjectionField } = await import("@/lib/shopify/product-sync");
        await adoptShopifyProjectionField(subject.rootEntityId, path);
      }
    }

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
        divergenceId: row.id,
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
    await release(true);
    return {
      divergenceId: row.id,
      ok: true,
      message: choice === "SYNARAVA" ? "Synarava was applied to Shopify." : "Shopify was applied to Synarava.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "This change could not be applied.";
    await release(false).catch(() => undefined);
    try {
      const event = await recordSyncEvent({
        bindingId: row.bindingId,
        locale: await contentLocaleForShopify(row.locale),
        direction,
        status: "FAILED",
        error: message,
        actorUsername,
      });
      await recordReconcileAuditDetails({
        eventId: event.id,
        scope: {
          divergenceId: row.id,
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
      // Guard/result remains authoritative if audit enrichment is unavailable.
    }
    return { divergenceId: row.id, ok: false, message };
  } finally {
    await release(false).catch(() => undefined);
  }
}

/** Shared product/collection entry — claims by natural key, not sourceId. */
export async function applyTranslationConflictChoice(input: {
  rootEntityType: "PRODUCT" | "COLLECTION"; rootEntityId: string; conflictFieldKey: string;
  choice: ReconcileChoice; expectedLocalFingerprint: string; expectedShopifyFingerprint: string;
  actorUsername: string;
}): Promise<ReconcileApplyResult> {
  const parsed = parseTranslationConflictFieldKey(input.conflictFieldKey);
  if (!parsed) return { divergenceId: null, ok: false, message: "This translated field address is invalid." };
  return applyReconcileChoice({ ...input, ...parsed });
}
