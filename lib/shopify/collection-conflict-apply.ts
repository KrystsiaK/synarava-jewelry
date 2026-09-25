import "server-only";

import {
  getCollectionCatalogConflict,
  listConflictedCollectionIds,
} from "./collection-conflict";
import type {
  CatalogConflictDirection,
  CatalogConflictField,
} from "./catalog-conflict";
import { applyReconcileChoice } from "./reconciliation-apply";

const MAX_BULK_COLLECTIONS = 50;
const MAX_APPLY_ENTRIES = 200;

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

export type CollectionConflictPreview = {
  entries: ResolvedCollectionConflictEntry[];
  excluded: ExcludedCollectionConflictEntry[];
  truncated: boolean;
};

export type CollectionConflictApplyEntryInput = {
  collectionId: string;
  fieldKey: string;
  direction: CatalogConflictDirection;
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
};

export type CollectionConflictApplyEntryResult = {
  collectionId: string;
  fieldKey: string;
  ok: boolean;
  reason?: "STALE" | "NEEDS_CLEAR_CONFIRMATION" | "WRITE_FAILED" | "UNSUPPORTED";
  message: string;
};

export type CollectionConflictApplyOutcome = {
  results: CollectionConflictApplyEntryResult[];
  appliedCount: number;
  failedCount: number;
};

function isEmptyValue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "—";
}

function willClear(field: CatalogConflictField, direction: CatalogConflictDirection): boolean {
  const [source, destination] = direction === "SHOPIFY_TO_SYNARAVA"
    ? [field.shopifyValue, field.synaravaValue]
    : [field.synaravaValue, field.shopifyValue];
  return isEmptyValue(source) && !isEmptyValue(destination);
}

/**
 * Same preview contract as catalog products, scoped to collections:
 * only TRANSLATION-origin fields from the collection conflict read model.
 * @see https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRegister
 */
export async function previewCollectionConflictResolution(scope: CollectionConflictApplyScope): Promise<CollectionConflictPreview> {
  const entries: ResolvedCollectionConflictEntry[] = [];
  const excluded: ExcludedCollectionConflictEntry[] = [];
  let truncated = false;

  async function resolveCollectionDirection(
    collectionId: string,
    direction: CatalogConflictDirection,
    onlyFieldKeys?: Set<string>,
  ) {
    const conflict = await getCollectionCatalogConflict(collectionId);
    for (const field of conflict.fields) {
      if (onlyFieldKeys && !onlyFieldKeys.has(field.fieldKey)) continue;
      if (!field.allowedDirections.includes(direction) || field.blockedReason) {
        excluded.push({
          collectionId,
          fieldKey: field.fieldKey,
          label: field.label,
          reason: field.blockedReason ?? "This direction isn't supported for this field.",
        });
        continue;
      }
      entries.push({ collectionId, direction, field, willClearNonEmptyValue: willClear(field, direction) });
    }
  }

  if (scope.kind === "BULK") {
    const allIds = await listConflictedCollectionIds();
    const collectionIds = allIds.slice(0, MAX_BULK_COLLECTIONS);
    truncated = allIds.length > collectionIds.length;
    for (const collectionId of collectionIds) await resolveCollectionDirection(collectionId, scope.direction);
  } else if (scope.kind === "COLLECTION") {
    await resolveCollectionDirection(scope.collectionId, scope.direction);
  } else {
    const byCollection = new Map<string, Array<{ fieldKey: string; direction: CatalogConflictDirection }>>();
    for (const selection of scope.selections) {
      const list = byCollection.get(selection.collectionId) ?? [];
      list.push(selection);
      byCollection.set(selection.collectionId, list);
    }
    for (const [collectionId, selections] of byCollection) {
      const conflict = await getCollectionCatalogConflict(collectionId);
      const currentFieldKeys = new Set(conflict.fields.map((field) => field.fieldKey));
      for (const selection of selections) {
        if (!currentFieldKeys.has(selection.fieldKey)) {
          excluded.push({
            collectionId,
            fieldKey: selection.fieldKey,
            label: selection.fieldKey,
            reason: "This field is no longer conflicting.",
          });
        }
      }
      const byDirection = new Map<CatalogConflictDirection, Set<string>>();
      for (const selection of selections) {
        if (!currentFieldKeys.has(selection.fieldKey)) continue;
        const set = byDirection.get(selection.direction) ?? new Set<string>();
        set.add(selection.fieldKey);
        byDirection.set(selection.direction, set);
      }
      for (const [direction, fieldKeys] of byDirection) {
        await resolveCollectionDirection(collectionId, direction, fieldKeys);
      }
    }
  }

  return {
    entries: entries.slice(0, MAX_APPLY_ENTRIES),
    excluded,
    truncated: truncated || entries.length > MAX_APPLY_ENTRIES,
  };
}

function staleResult(entry: CollectionConflictApplyEntryInput, message: string): CollectionConflictApplyEntryResult {
  return { collectionId: entry.collectionId, fieldKey: entry.fieldKey, ok: false, reason: "STALE", message };
}

/** Re-validates fingerprints then applies TRANSLATION fields via applyReconcileChoice. */
export async function applyCollectionConflictResolution({
  entries,
  acknowledgeClears,
  actorUsername,
}: {
  entries: CollectionConflictApplyEntryInput[];
  acknowledgeClears: boolean;
  actorUsername: string;
}): Promise<CollectionConflictApplyOutcome> {
  if (entries.length > MAX_APPLY_ENTRIES) {
    throw new Error(`Too many changes in one batch (${entries.length}); max is ${MAX_APPLY_ENTRIES}.`);
  }

  const results: CollectionConflictApplyEntryResult[] = [];
  const ready: Array<{ input: CollectionConflictApplyEntryInput; field: CatalogConflictField }> = [];

  const collectionIds = [...new Set(entries.map((entry) => entry.collectionId))];
  const conflictsByCollection = new Map(
    await Promise.all(
      collectionIds.map(async (collectionId) => [collectionId, await getCollectionCatalogConflict(collectionId)] as const),
    ),
  );

  for (const entry of entries) {
    const conflict = conflictsByCollection.get(entry.collectionId);
    const field = conflict?.fields.find((candidate) => candidate.fieldKey === entry.fieldKey);
    if (!field) {
      results.push(staleResult(entry, "This conflict no longer exists — it may already have been resolved."));
      continue;
    }
    if (field.localFingerprint !== entry.expectedLocalFingerprint || field.shopifyFingerprint !== entry.expectedShopifyFingerprint) {
      results.push(staleResult(entry, "Synarava or Shopify changed since this was reviewed. Refresh and try again."));
      continue;
    }
    if (!field.allowedDirections.includes(entry.direction) || field.blockedReason) {
      results.push({
        collectionId: entry.collectionId,
        fieldKey: entry.fieldKey,
        ok: false,
        reason: "UNSUPPORTED",
        message: field.blockedReason ?? "This direction isn't supported for this field.",
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
    if (field.origin !== "TRANSLATION" || !field.sourceId) {
      results.push({
        collectionId: entry.collectionId,
        fieldKey: entry.fieldKey,
        ok: false,
        reason: "UNSUPPORTED",
        message: "Only translated collection fields can be resolved here.",
      });
      continue;
    }
    ready.push({ input: entry, field });
  }

  for (const { input, field } of ready) {
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

  const failedCount = results.filter((result) => !result.ok).length;
  return { results, appliedCount: results.length - failedCount, failedCount };
}
