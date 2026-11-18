/**
 * SHOP ConflictResolver preview + Apply (free-shipping threshold leaf).
 */

import "server-only";

import {
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
import { isScopedShopCommerceFieldLabel } from "@/lib/shopify/catalog-conflict-policy";
import type { CatalogConflictDirection, CatalogConflictField } from "@/lib/shopify/catalog-conflict";
import { applyShopCommerceField } from "@/lib/shopify/shop-commerce-field-apply";
import {
  listConflictedShopIds,
  loadShopConflictFromSyncResult,
} from "@/lib/shopify/shop-conflict";

const SHOP_PUSH_UNSUPPORTED =
  "Free shipping threshold is Shopify-owned (Portugal delivery profile). Take Shopify only — never push.";

function isScopedShopField(field: CatalogConflictField): boolean {
  return field.origin === "COMMERCE" && isScopedShopCommerceFieldLabel(field.label);
}

export type ShopConflictApplyScope =
  | { kind: "BULK"; direction: CatalogConflictDirection }
  | { kind: "SHOP"; shopId: string; direction: CatalogConflictDirection }
  | { kind: "MANUAL"; selections: Array<{ shopId: string; fieldKey: string; direction: CatalogConflictDirection }> };

export type ShopConflictApplyEntryInput = ConflictApplyEntryInputBase & {
  shopId: string;
};

export type ShopConflictApplyEntryResult = ConflictApplyEntryResultBase & {
  shopId: string;
};

export type ShopConflictApplyOutcome = ConflictApplyOutcomeBase<ShopConflictApplyEntryResult>;

export type ResolvedShopConflictEntry = {
  shopId: string;
  direction: CatalogConflictDirection;
  field: CatalogConflictField;
  willClearNonEmptyValue: boolean;
};

export type ExcludedShopConflictEntry = {
  shopId: string;
  fieldKey: string;
  label: string;
  reason: string;
};

export type ShopConflictPreview = ConflictPreviewBase<ResolvedShopConflictEntry, ExcludedShopConflictEntry>;

async function loadShopConflictForApply(
  shopId: string,
  requestedBy: string,
): Promise<{ fields: CatalogConflictField[] }> {
  return loadShopConflictFromSyncResult(shopId, {
    requestedBy,
    skipRefresh: false,
  });
}

export async function previewShopConflictResolution(
  scope: ShopConflictApplyScope,
  requestedBy: string,
): Promise<ShopConflictPreview> {
  const mapped = scope.kind === "MANUAL"
    ? {
        kind: "MANUAL" as const,
        selections: scope.selections.map((selection) => ({
          entityId: selection.shopId,
          fieldKey: selection.fieldKey,
          direction: selection.direction,
        })),
      }
    : scope.kind === "SHOP"
      ? { kind: "ENTITY" as const, entityId: scope.shopId, direction: scope.direction }
      : { kind: "BULK" as const, direction: scope.direction };

  return resolveConflictPreviewScope({
    maxBulk: 10,
    listConflictedIds: () => listConflictedShopIds(requestedBy),
    loadConflict: (shopId) => loadShopConflictForApply(shopId, requestedBy),
    scope: mapped,
    classifyField(field, direction) {
      if (field.origin === "COMMERCE" && !isSelectableCommerceField(field, isScopedShopField)) {
        return { kind: "exclude", reason: "This shop field cannot be applied field-by-field." };
      }
      if (!field.allowedDirections.includes(direction)) {
        return {
          kind: "exclude",
          reason: direction === "SYNARAVA_TO_SHOPIFY"
            ? SHOP_PUSH_UNSUPPORTED
            : (field.blockedReason ?? sharedUnsupportedDirectionReason(field, {
              shopifyOnly: SHOP_PUSH_UNSUPPORTED,
              synaravaOnly: SHOP_PUSH_UNSUPPORTED,
            })),
        };
      }
      return { kind: "include", willClearNonEmptyValue: willClear(field, direction) };
    },
    toEntry: (shopId, direction, field, willClearNonEmptyValue) => ({
      shopId,
      direction,
      field,
      willClearNonEmptyValue,
    }),
    toExcluded: (shopId, fieldKey, label, reason) => ({ shopId, fieldKey, label, reason }),
  });
}

export async function applyShopConflictResolution({
  entries,
  acknowledgeClears,
  actorUsername,
}: {
  entries: ShopConflictApplyEntryInput[];
  acknowledgeClears: boolean;
  actorUsername: string;
}): Promise<ShopConflictApplyOutcome> {
  if (entries.length > MAX_CONFLICT_APPLY_ENTRIES) {
    throw new Error(`Too many changes in one batch (${entries.length}); max is ${MAX_CONFLICT_APPLY_ENTRIES}.`);
  }

  const results: ShopConflictApplyEntryResult[] = [];
  const shopIds = [...new Set(entries.map((entry) => entry.shopId))];
  const conflictsByShop = new Map(
    await Promise.all(
      shopIds.map(async (shopId) => [
        shopId,
        await loadShopConflictForApply(shopId, actorUsername),
      ] as const),
    ),
  );

  for (const entry of entries) {
    const conflict = conflictsByShop.get(entry.shopId);
    const field = conflict?.fields.find((candidate) => candidate.fieldKey === entry.fieldKey);
    if (!field) {
      results.push(sharedStaleResult(entry, "shopId", "This conflict no longer exists — it may already have been resolved."));
      continue;
    }
    if (
      field.localFingerprint !== entry.expectedLocalFingerprint
      || field.shopifyFingerprint !== entry.expectedShopifyFingerprint
    ) {
      results.push(sharedStaleResult(entry, "shopId", "Synarava or Shopify changed since this was reviewed. Refresh and try again."));
      continue;
    }
    if (field.origin === "COMMERCE" && !isSelectableCommerceField(field, isScopedShopField)) {
      results.push({
        shopId: entry.shopId,
        fieldKey: entry.fieldKey,
        ok: false,
        reason: "UNSUPPORTED",
        message: "This shop field cannot be applied field-by-field.",
      });
      continue;
    }
    if (!field.allowedDirections.includes(entry.direction)) {
      results.push({
        shopId: entry.shopId,
        fieldKey: entry.fieldKey,
        ok: false,
        reason: "UNSUPPORTED",
        message: entry.direction === "SYNARAVA_TO_SHOPIFY"
          ? SHOP_PUSH_UNSUPPORTED
          : (field.blockedReason ?? SHOP_PUSH_UNSUPPORTED),
      });
      continue;
    }
    if (!acknowledgeClears && willClear(field, entry.direction)) {
      results.push({
        shopId: entry.shopId,
        fieldKey: entry.fieldKey,
        ok: false,
        reason: "NEEDS_CLEAR_CONFIRMATION",
        message: "This would clear a non-empty value. Confirm clearing before applying.",
      });
      continue;
    }

    const outcome = await applyShopCommerceField({
      shopId: entry.shopId,
      label: field.label,
      fieldKey: field.fieldKey,
      direction: entry.direction,
      expectedLocalFingerprint: entry.expectedLocalFingerprint,
      expectedShopifyFingerprint: entry.expectedShopifyFingerprint,
      requestedBy: actorUsername,
    });
    results.push(
      outcome.ok
        ? { shopId: entry.shopId, fieldKey: entry.fieldKey, ok: true, message: outcome.message }
        : {
            shopId: entry.shopId,
            fieldKey: entry.fieldKey,
            ok: false,
            reason: outcome.reason,
            message: outcome.message,
          },
    );
  }

  return summarizeApplyOutcome(results);
}
