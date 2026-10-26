import type {
  CatalogConflictDirection,
  CatalogConflictField,
} from "@/lib/shopify/catalog-conflict";
import { isAdoptShopifyConflictField } from "@/lib/shopify/catalog-conflict-policy";

export const MAX_CONFLICT_APPLY_ENTRIES = 200;

export type ConflictApplyFailureReason =
  | "STALE"
  | "NEEDS_CLEAR_CONFIRMATION"
  | "WRITE_FAILED"
  | "UNSUPPORTED";

export type ConflictApplyEntryInputBase = {
  fieldKey: string;
  direction: CatalogConflictDirection;
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
};

export type ConflictApplyEntryResultBase = {
  fieldKey: string;
  ok: boolean;
  reason?: ConflictApplyFailureReason;
  message: string;
};

export type ConflictApplyOutcomeBase<TResult> = {
  results: TResult[];
  appliedCount: number;
  failedCount: number;
};

export type ConflictPreviewBase<TEntry, TExcluded> = {
  entries: TEntry[];
  excluded: TExcluded[];
  truncated: boolean;
};

export function isEmptyValue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "—";
}

export function willClear(field: CatalogConflictField, direction: CatalogConflictDirection): boolean {
  const [source, destination] = direction === "SHOPIFY_TO_SYNARAVA"
    ? [field.shopifyValue, field.synaravaValue]
    : [field.synaravaValue, field.shopifyValue];
  return isEmptyValue(source) && !isEmptyValue(destination);
}

export type PresenceUnsupportedReasons = {
  shopifyOnly: string;
  synaravaOnly: string;
};

export const PRODUCT_PRESENCE_UNSUPPORTED: PresenceUnsupportedReasons = {
  shopifyOnly: "This product only exists in Shopify. Pull it first, or run the Shopify → Synarava bulk action.",
  synaravaOnly: "This product only exists in Synarava. Push it first, or run the Synarava → Shopify bulk action.",
};

export const COLLECTION_PRESENCE_UNSUPPORTED: PresenceUnsupportedReasons = {
  shopifyOnly: "This collection only exists in Shopify. Pull it first, or run the Shopify → Synarava bulk action.",
  synaravaOnly: "This collection only exists in Synarava. Push it to Shopify, or choose Shopify to remove it from Synarava.",
};

export function unsupportedDirectionReason(
  field: CatalogConflictField,
  presence: PresenceUnsupportedReasons,
): string {
  if (field.origin === "PRESENCE") {
    return field.presenceDifference?.kind === "SHOPIFY_ONLY"
      ? presence.shopifyOnly
      : presence.synaravaOnly;
  }
  if (isAdoptShopifyConflictField(field)) {
    return "Synarava has no commerce window yet. Adopt Shopify first (Shopify → Synarava).";
  }
  return field.blockedReason ?? "This direction isn't supported for this field.";
}

export function isSelectableCommerceField(
  field: CatalogConflictField,
  isScoped: (field: CatalogConflictField) => boolean,
): boolean {
  return isAdoptShopifyConflictField(field) || isScoped(field);
}

export function staleResult<TEntry extends { fieldKey: string }, TId extends string>(
  entry: TEntry & Record<TId, string>,
  idKey: TId,
  message: string,
): ConflictApplyEntryResultBase & Record<TId, string> {
  return {
    [idKey]: entry[idKey],
    fieldKey: entry.fieldKey,
    ok: false,
    reason: "STALE",
    message,
  } as ConflictApplyEntryResultBase & Record<TId, string>;
}

export function summarizeApplyOutcome<TResult extends { ok: boolean }>(
  results: TResult[],
): ConflictApplyOutcomeBase<TResult> {
  const failedCount = results.filter((result) => !result.ok).length;
  return { results, appliedCount: results.length - failedCount, failedCount };
}

export type ConflictFieldClassification =
  | { kind: "include"; willClearNonEmptyValue: boolean }
  | { kind: "exclude"; reason: string };

/** Shared BULK / single-entity / MANUAL preview walk used by product + collection apply. */
export async function resolveConflictPreviewScope<TEntry, TExcluded>(input: {
  maxBulk: number;
  listConflictedIds: () => Promise<string[]>;
  loadConflict: (entityId: string) => Promise<{ fields: CatalogConflictField[] }>;
  scope:
    | { kind: "BULK"; direction: CatalogConflictDirection }
    | { kind: "ENTITY"; entityId: string; direction: CatalogConflictDirection }
    | { kind: "MANUAL"; selections: Array<{ entityId: string; fieldKey: string; direction: CatalogConflictDirection }> };
  classifyField: (
    field: CatalogConflictField,
    direction: CatalogConflictDirection,
  ) => ConflictFieldClassification;
  toEntry: (
    entityId: string,
    direction: CatalogConflictDirection,
    field: CatalogConflictField,
    willClearNonEmptyValue: boolean,
  ) => TEntry;
  toExcluded: (entityId: string, fieldKey: string, label: string, reason: string) => TExcluded;
  /** Collection skips missing keys when grouping MANUAL resolve; product still groups them (harmless). */
  skipMissingKeysWhenGroupingManual?: boolean;
}): Promise<ConflictPreviewBase<TEntry, TExcluded>> {
  const entries: TEntry[] = [];
  const excluded: TExcluded[] = [];
  let truncated = false;

  async function resolveEntityDirection(
    entityId: string,
    direction: CatalogConflictDirection,
    onlyFieldKeys?: Set<string>,
  ) {
    const conflict = await input.loadConflict(entityId);
    for (const field of conflict.fields) {
      if (onlyFieldKeys && !onlyFieldKeys.has(field.fieldKey)) continue;
      const classified = input.classifyField(field, direction);
      if (classified.kind === "exclude") {
        excluded.push(input.toExcluded(entityId, field.fieldKey, field.label, classified.reason));
        continue;
      }
      entries.push(input.toEntry(entityId, direction, field, classified.willClearNonEmptyValue));
    }
  }

  if (input.scope.kind === "BULK") {
    const allIds = await input.listConflictedIds();
    const ids = allIds.slice(0, input.maxBulk);
    truncated = allIds.length > ids.length;
    for (const entityId of ids) await resolveEntityDirection(entityId, input.scope.direction);
  } else if (input.scope.kind === "ENTITY") {
    await resolveEntityDirection(input.scope.entityId, input.scope.direction);
  } else {
    const byEntity = new Map<string, Array<{ fieldKey: string; direction: CatalogConflictDirection }>>();
    for (const selection of input.scope.selections) {
      const list = byEntity.get(selection.entityId) ?? [];
      list.push(selection);
      byEntity.set(selection.entityId, list);
    }
    for (const [entityId, selections] of byEntity) {
      const conflict = await input.loadConflict(entityId);
      const currentFieldKeys = new Set(conflict.fields.map((field) => field.fieldKey));
      for (const selection of selections) {
        if (!currentFieldKeys.has(selection.fieldKey)) {
          excluded.push(input.toExcluded(
            entityId,
            selection.fieldKey,
            selection.fieldKey,
            "This field is no longer conflicting.",
          ));
        }
      }
      const byDirection = new Map<CatalogConflictDirection, Set<string>>();
      for (const selection of selections) {
        if (input.skipMissingKeysWhenGroupingManual && !currentFieldKeys.has(selection.fieldKey)) continue;
        const set = byDirection.get(selection.direction) ?? new Set<string>();
        set.add(selection.fieldKey);
        byDirection.set(selection.direction, set);
      }
      for (const [direction, fieldKeys] of byDirection) {
        await resolveEntityDirection(entityId, direction, fieldKeys);
      }
    }
  }

  return {
    entries: entries.slice(0, MAX_CONFLICT_APPLY_ENTRIES),
    excluded,
    truncated: truncated || entries.length > MAX_CONFLICT_APPLY_ENTRIES,
  };
}
