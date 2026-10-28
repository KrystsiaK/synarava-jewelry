import "server-only";

import { db } from "@/lib/db";

import {
  COLLECTION_PRESENCE_UNSUPPORTED,
  isSelectableCommerceField,
  MAX_CONFLICT_APPLY_ENTRIES,
  resolveConflictPreviewScope,
  staleResult as sharedStaleResult,
  summarizeApplyOutcome,
  unsupportedDirectionReason as sharedUnsupportedDirectionReason,
  willClear,
  type ConflictApplyEntryInputBase,
  type ConflictApplyEntryResultBase,
  type ConflictApplyOutcomeBase,
  type ConflictPreviewBase,
} from "@/lib/sync/conflicts/apply-shared";

import type {
  CatalogConflictDirection,
  CatalogConflictField,
} from "./catalog-conflict";
import { isAdoptShopifyConflictField } from "./catalog-conflict-policy";
import { applyCollectionCommerceField, isScopedCollectionCommerceFieldLabel } from "./collection-commerce-field-apply";
import {
  listConflictedCollectionIds,
  loadCollectionConflictFromSyncResult,
  type CollectionCatalogConflict,
} from "./collection-conflict";
import type { CollectionPresenceDifference } from "./collection-presence";
import {
  applyCollectionPresenceDifference,
  applyShopifyCollectionToSynarava,
  scanAndSaveCollectionPresence,
} from "./collection-presence-server";
import { applyReconcileChoice } from "./reconciliation-apply";

const MAX_BULK_COLLECTIONS = 50;

export type CollectionConflictApplyScope =
  | { kind: "BULK"; direction: CatalogConflictDirection }
  | { kind: "COLLECTION"; collectionId: string; direction: CatalogConflictDirection }
  | { kind: "MANUAL"; selections: Array<{ collectionId: string; fieldKey: string; direction: CatalogConflictDirection }> };

export type ResolvedCollectionConflictEntry = {
  collectionId: string;
  direction: CatalogConflictDirection;
  field: CatalogConflictField;
  willClearNonEmptyValue: boolean;
};

export type ExcludedCollectionConflictEntry = {
  collectionId: string;
  fieldKey: string;
  label: string;
  reason: string;
};

export type CollectionConflictPreview = ConflictPreviewBase<
  ResolvedCollectionConflictEntry,
  ExcludedCollectionConflictEntry
>;

export type CollectionConflictApplyEntryInput = ConflictApplyEntryInputBase & {
  collectionId: string;
};

export type CollectionConflictApplyEntryResult = ConflictApplyEntryResultBase & {
  collectionId: string;
  localCollectionId?: string;
};

export type CollectionConflictApplyOutcome = ConflictApplyOutcomeBase<CollectionConflictApplyEntryResult>;

function isPresenceDiscard(field: CatalogConflictField, direction: CatalogConflictDirection): boolean {
  return field.origin === "PRESENCE"
    && field.presenceDifference?.kind === "SYNARAVA_ONLY"
    && direction === "SHOPIFY_TO_SYNARAVA";
}

function isCollectionScoped(field: CatalogConflictField): boolean {
  return isScopedCollectionCommerceFieldLabel(field.label);
}

/**
 * Same preview contract as catalog products, scoped to collections:
 * COMMERCE + TRANSLATION + PRESENCE fields from the collection conflict read model.
 */
async function loadCollectionConflictForApply(
  collectionId: string,
  requestedBy: string,
): Promise<CollectionCatalogConflict> {
  // Refresh Shopify for this collection, then map SyncResult leaves
  // (same compare as the list — no inspect.differences second compare).
  return loadCollectionConflictFromSyncResult(collectionId, {
    requestedBy,
    skipRefresh: false,
  });
}

export async function previewCollectionConflictResolution(
  scope: CollectionConflictApplyScope,
  options?: { requestedBy?: string },
): Promise<CollectionConflictPreview> {
  const requestedBy = options?.requestedBy ?? "system";
  const normalized =
    scope.kind === "BULK" ? scope
    : scope.kind === "COLLECTION" ? { kind: "ENTITY" as const, entityId: scope.collectionId, direction: scope.direction }
    : {
        kind: "MANUAL" as const,
        selections: scope.selections.map((selection) => ({
          entityId: selection.collectionId,
          fieldKey: selection.fieldKey,
          direction: selection.direction,
        })),
      };

  return resolveConflictPreviewScope({
    maxBulk: MAX_BULK_COLLECTIONS,
    listConflictedIds: listConflictedCollectionIds,
    loadConflict: (collectionId) => loadCollectionConflictForApply(collectionId, requestedBy),
    scope: normalized,
    skipMissingKeysWhenGroupingManual: true,
    classifyField(field, direction) {
      if (field.origin === "COMMERCE" && !isSelectableCommerceField(field, isCollectionScoped)) {
        return {
          kind: "exclude",
          reason: field.blockedReason ?? "This collection commerce field cannot be applied field-by-field.",
        };
      }
      if (!field.allowedDirections.includes(direction) || field.blockedReason) {
        return { kind: "exclude", reason: sharedUnsupportedDirectionReason(field, COLLECTION_PRESENCE_UNSUPPORTED) };
      }
      return {
        kind: "include",
        willClearNonEmptyValue: isPresenceDiscard(field, direction) || willClear(field, direction),
      };
    },
    toEntry: (collectionId, direction, field, willClearNonEmptyValue) => ({
      collectionId, direction, field, willClearNonEmptyValue,
    }),
    toExcluded: (collectionId, fieldKey, label, reason) => ({ collectionId, fieldKey, label, reason }),
  });
}

/** Re-validates fingerprints then applies COMMERCE / TRANSLATION / PRESENCE fields. */
export async function applyCollectionConflictResolution({
  entries,
  acknowledgeClears,
  actorUsername,
}: {
  entries: CollectionConflictApplyEntryInput[];
  acknowledgeClears: boolean;
  actorUsername: string;
}): Promise<CollectionConflictApplyOutcome> {
  if (entries.length > MAX_CONFLICT_APPLY_ENTRIES) {
    throw new Error(`Too many changes in one batch (${entries.length}); max is ${MAX_CONFLICT_APPLY_ENTRIES}.`);
  }

  const results: CollectionConflictApplyEntryResult[] = [];
  const readyTranslation: Array<{ input: CollectionConflictApplyEntryInput; field: CatalogConflictField }> = [];
  const readyPresence: Array<{ input: CollectionConflictApplyEntryInput; field: CatalogConflictField }> = [];
  const readyCommerce: Array<{ input: CollectionConflictApplyEntryInput; field: CatalogConflictField }> = [];
  const readyAdopt: Array<{ input: CollectionConflictApplyEntryInput; field: CatalogConflictField }> = [];

  if (entries.some((entry) => entry.fieldKey === "presence:collection")) {
    await scanAndSaveCollectionPresence(null);
  }

  const collectionIds = [...new Set(entries.map((entry) => entry.collectionId))];
  const conflictsByCollection = new Map(
    await Promise.all(
      collectionIds.map(async (collectionId) => [
        collectionId,
        await loadCollectionConflictForApply(collectionId, actorUsername),
      ] as const),
    ),
  );

  for (const entry of entries) {
    const conflict = conflictsByCollection.get(entry.collectionId);
    const field = conflict?.fields.find((candidate) => candidate.fieldKey === entry.fieldKey);
    if (!field) {
      results.push(sharedStaleResult(entry, "collectionId", "This conflict no longer exists — it may already have been resolved."));
      continue;
    }
    if (field.localFingerprint !== entry.expectedLocalFingerprint || field.shopifyFingerprint !== entry.expectedShopifyFingerprint) {
      results.push(sharedStaleResult(entry, "collectionId", "Synarava or Shopify changed since this was reviewed. Refresh and try again."));
      continue;
    }
    if (field.origin === "COMMERCE" && !isSelectableCommerceField(field, isCollectionScoped)) {
      results.push({
        collectionId: entry.collectionId,
        fieldKey: entry.fieldKey,
        ok: false,
        reason: "UNSUPPORTED",
        message: field.blockedReason ?? "This collection commerce field cannot be applied field-by-field.",
      });
      continue;
    }
    if (!field.allowedDirections.includes(entry.direction) || field.blockedReason) {
      results.push({
        collectionId: entry.collectionId,
        fieldKey: entry.fieldKey,
        ok: false,
        reason: "UNSUPPORTED",
        message: sharedUnsupportedDirectionReason(field, COLLECTION_PRESENCE_UNSUPPORTED),
      });
      continue;
    }
    if (!acknowledgeClears && willClear(field, entry.direction)) {
      results.push({
        collectionId: entry.collectionId,
        fieldKey: entry.fieldKey,
        ok: false,
        reason: "NEEDS_CLEAR_CONFIRMATION",
        message: "This would clear a non-empty value. Confirm clearing before applying.",
      });
      continue;
    }
    if (field.origin === "PRESENCE") readyPresence.push({ input: entry, field });
    else if (field.origin === "TRANSLATION" && field.sourceId) readyTranslation.push({ input: entry, field });
    else if (isAdoptShopifyConflictField(field)) readyAdopt.push({ input: entry, field });
    else if (field.origin === "COMMERCE") readyCommerce.push({ input: entry, field });
    else {
      results.push({
        collectionId: entry.collectionId,
        fieldKey: entry.fieldKey,
        ok: false,
        reason: "UNSUPPORTED",
        message: "Only commerce, translated, or presence collection fields can be resolved here.",
      });
    }
  }

  for (const { input } of readyAdopt) {
    try {
      const collection = await db.collection.findUnique({
        where: { id: input.collectionId },
        select: { shopifyCollectionId: true },
      });
      if (!collection?.shopifyCollectionId) {
        results.push({
          collectionId: input.collectionId,
          fieldKey: input.fieldKey,
          ok: false,
          reason: "WRITE_FAILED",
          message: "This collection is not linked to Shopify.",
        });
        continue;
      }
      const pulled = await applyShopifyCollectionToSynarava(collection.shopifyCollectionId, input.collectionId);
      results.push({
        collectionId: input.collectionId,
        fieldKey: input.fieldKey,
        ok: true,
        message: "Adopted Shopify as the Synarava commerce window.",
        localCollectionId: pulled.collectionId,
      });
    } catch (error) {
      results.push({
        collectionId: input.collectionId,
        fieldKey: input.fieldKey,
        ok: false,
        reason: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "Shopify could not be adopted into Synarava.",
      });
    }
  }

  for (const { input, field } of readyPresence) {
    if (!field.presenceDifference) {
      results.push({
        collectionId: input.collectionId,
        fieldKey: input.fieldKey,
        ok: false,
        reason: "WRITE_FAILED",
        message: "This collection-presence conflict is missing its source record.",
      });
      continue;
    }
    try {
      const outcome = await applyCollectionPresenceDifference({
        difference: field.presenceDifference as CollectionPresenceDifference,
        direction: input.direction,
      });
      results.push(outcome.ok
        ? {
            collectionId: input.collectionId,
            localCollectionId: outcome.localCollectionId,
            fieldKey: input.fieldKey,
            ok: true,
            message: outcome.message,
          }
        : {
            collectionId: input.collectionId,
            fieldKey: input.fieldKey,
            ok: false,
            reason: outcome.reason,
            message: outcome.message,
          });
    } catch (error) {
      results.push({
        collectionId: input.collectionId,
        fieldKey: input.fieldKey,
        ok: false,
        reason: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "This collection could not be synchronized.",
      });
    }
  }

  for (const { input, field } of readyTranslation) {
    try {
      const outcome = await applyReconcileChoice({
        divergenceId: field.sourceId!,
        choice: input.direction === "SYNARAVA_TO_SHOPIFY" ? "SYNARAVA" : "SHOPIFY",
        expectedLocalFingerprint: input.expectedLocalFingerprint,
        expectedShopifyFingerprint: input.expectedShopifyFingerprint,
        actorUsername,
      });
      results.push(
        outcome.ok
          ? { collectionId: input.collectionId, fieldKey: input.fieldKey, ok: true, message: outcome.message }
          : { collectionId: input.collectionId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: outcome.message },
      );
    } catch (error) {
      results.push({
        collectionId: input.collectionId,
        fieldKey: input.fieldKey,
        ok: false,
        reason: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "This change could not be applied.",
      });
    }
  }

  for (const { input, field } of readyCommerce) {
    try {
      const outcome = await applyCollectionCommerceField({
        collectionId: input.collectionId,
        label: field.label,
        fieldKey: field.fieldKey,
        direction: input.direction,
        expectedLocalFingerprint: input.expectedLocalFingerprint,
        expectedShopifyFingerprint: input.expectedShopifyFingerprint,
        requestedBy: actorUsername,
      });
      results.push(
        outcome.ok
          ? { collectionId: input.collectionId, fieldKey: input.fieldKey, ok: true, message: outcome.message }
          : { collectionId: input.collectionId, fieldKey: input.fieldKey, ok: false, reason: outcome.reason, message: outcome.message },
      );
    } catch (error) {
      results.push({
        collectionId: input.collectionId,
        fieldKey: input.fieldKey,
        ok: false,
        reason: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "This change could not be applied.",
      });
    }
  }

  return summarizeApplyOutcome(results);
}
