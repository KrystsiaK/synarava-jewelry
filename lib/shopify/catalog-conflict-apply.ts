import "server-only";

import { db } from "@/lib/db";

import {
  gateWriteConvergence,
  intendedAddressFromLeaf,
  recheckEntityConflictLeaves,
  treeNodeForLocale,
  type IntendedConflictAddress,
} from "@/lib/sync";
import {
  isSelectableCommerceField,
  MAX_CONFLICT_APPLY_ENTRIES,
  PRODUCT_PRESENCE_UNSUPPORTED,
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

import {
  isAdoptShopifyConflictField,
  listConflictedProductIds,
  loadProductConflictFromSyncResult,
  type CatalogConflictDirection,
  type CatalogConflictField,
  type ProductCatalogConflict,
} from "./catalog-conflict";
import { applyCommerceField } from "./commerce-field-apply";
import {
  COMMERCE_UNSUPPORTED_REASON,
  isMediaIdentityContractKey,
  isScopedProductCommerceFieldLabel,
} from "./catalog-conflict-policy";
import { applyCatalogPresenceDifference, scanAndSaveCatalogPresence } from "./catalog-presence-server";
import { applyMediaIdentityBatch } from "./media-identity-apply";
import { applyShopifyProductToSynarava } from "./product-sync";
import { applyTranslationConflictChoice } from "./reconciliation-apply";

function isVirtualPresenceProductId(productId: string): boolean {
  return productId.startsWith("shopify:");
}

/** Refresh Shopify + SyncResult leaves for apply/preview (virtual presence skips network). */
async function loadProductConflictForApply(
  productId: string,
  requestedBy: string,
): Promise<ProductCatalogConflict> {
  if (isVirtualPresenceProductId(productId)) {
    return loadProductConflictFromSyncResult(productId, {
      requestedBy,
      skipRefresh: true,
    });
  }
  return loadProductConflictFromSyncResult(productId, {
    requestedBy,
    skipRefresh: false,
  });
}

export type WholeRecordFingerprintExpectation = {
  fieldKey: string;
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
};

/** Stale-fingerprint gate for whole-record pull/push (one aggregate expectation). */
export async function assertWholeRecordFingerprintsFresh(input: {
  productId: string;
  expected: WholeRecordFingerprintExpectation[];
  actorUsername: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.expected.length === 0) return { ok: true };
  const conflict = await loadProductConflictForApply(input.productId, input.actorUsername);
  for (const expected of input.expected) {
    const field = conflict.fields.find((candidate) => candidate.fieldKey === expected.fieldKey);
    if (
      !field
      || field.localFingerprint !== expected.expectedLocalFingerprint
      || field.shopifyFingerprint !== expected.expectedShopifyFingerprint
    ) {
      return {
        ok: false,
        error: "Synarava or Shopify changed since this was reviewed. Refresh and try again.",
      };
    }
  }
  return { ok: true };
}

/** Caps how many *products* one bulk preview/apply touches (not fields/product). */
const MAX_BULK_PRODUCTS = 50;

/** Product scoped (+ media) only — never collection label union. */
function isScopedCommerceField(field: CatalogConflictField): boolean {
  return field.origin === "COMMERCE" && isScopedProductCommerceFieldLabel(field.label);
}

export type CatalogConflictApplyScope =
  | { kind: "BULK"; direction: CatalogConflictDirection }
  | { kind: "PRODUCT"; productId: string; direction: CatalogConflictDirection }
  | { kind: "MANUAL"; selections: Array<{ productId: string; fieldKey: string; direction: CatalogConflictDirection }> };

export type ResolvedCatalogConflictEntry = {
  productId: string;
  direction: CatalogConflictDirection;
  field: CatalogConflictField;
  /** True when this direction would overwrite a non-empty destination value with an empty source value — the UX contract requires a separate, explicit confirmation before that's allowed to apply. */
  willClearNonEmptyValue: boolean;
};

export type ExcludedCatalogConflictEntry = {
  productId: string;
  fieldKey: string;
  label: string;
  reason: string;
};

export type CatalogConflictPreview = ConflictPreviewBase<ResolvedCatalogConflictEntry, ExcludedCatalogConflictEntry>;

/** Resolve scope → concrete fields; disallowed/stale/unsupported go to `excluded`. */
export async function previewCatalogConflictResolution(
  scope: CatalogConflictApplyScope,
  options?: { requestedBy?: string },
): Promise<CatalogConflictPreview> {
  const requestedBy = options?.requestedBy ?? "system";
  const normalized =
    scope.kind === "BULK" ? scope
    : scope.kind === "PRODUCT" ? { kind: "ENTITY" as const, entityId: scope.productId, direction: scope.direction }
    : {
        kind: "MANUAL" as const,
        selections: scope.selections.map((selection) => ({
          entityId: selection.productId,
          fieldKey: selection.fieldKey,
          direction: selection.direction,
        })),
      };

  return resolveConflictPreviewScope({
    maxBulk: MAX_BULK_PRODUCTS,
    listConflictedIds: listConflictedProductIds,
    loadConflict: (productId) => loadProductConflictForApply(productId, requestedBy),
    scope: normalized,
    classifyField(field, direction) {
      if (field.origin === "COMMERCE" && !isSelectableCommerceField(field, isScopedCommerceField)) {
        return { kind: "exclude", reason: COMMERCE_UNSUPPORTED_REASON };
      }
      // allowedDirections is authoritative; blockedReason is the human message only.
      if (!field.allowedDirections.includes(direction)) {
        return {
          kind: "exclude",
          reason: field.blockedReason
            ?? sharedUnsupportedDirectionReason(field, PRODUCT_PRESENCE_UNSUPPORTED),
        };
      }
      return { kind: "include", willClearNonEmptyValue: willClear(field, direction) };
    },
    toEntry: (productId, direction, field, willClearNonEmptyValue) => ({
      productId, direction, field, willClearNonEmptyValue,
    }),
    toExcluded: (productId, fieldKey, label, reason) => ({ productId, fieldKey, label, reason }),
  });
}

export type CatalogConflictApplyEntryInput = ConflictApplyEntryInputBase & {
  productId: string;
};

export type CatalogConflictApplyEntryResult = ConflictApplyEntryResultBase & {
  productId: string;
  localProductId?: string;
};

export type CatalogConflictApplyOutcome = ConflictApplyOutcomeBase<CatalogConflictApplyEntryResult>;

/**
 * Re-validates every requested entry against the product's current
 * conflict state right before writing anything — the client's expected
 * fingerprints must still match, or the entry is reported STALE and
 * skipped rather than overwritten.
 *
 * TRANSLATION-origin fields apply individually through
 * applyTranslationConflictChoice (natural-key claim; already atomic,
 * fingerprint-checked, and verified by a read-after-write). COMMERCE-origin
 * fields apply through applyCommerceField only when their label is in
 * SCOPED_COMMERCE_FIELD_LABELS; every other commerce field is reported
 * UNSUPPORTED — see COMMERCE_UNSUPPORTED_REASON at the top of this file.
 *
 * A repeated submission of the same input is safe: once an entry has been
 * applied, the underlying value/fingerprint has changed, so re-validation
 * reports it STALE instead of writing it again.
 */
export async function applyCatalogConflictResolution({
  entries,
  acknowledgeClears,
  actorUsername,
}: {
  entries: CatalogConflictApplyEntryInput[];
  acknowledgeClears: boolean;
  actorUsername: string;
}): Promise<CatalogConflictApplyOutcome> {
  if (entries.length > MAX_CONFLICT_APPLY_ENTRIES) {
    throw new Error(`Too many changes in one batch (${entries.length}); max is ${MAX_CONFLICT_APPLY_ENTRIES}.`);
  }

  const results: CatalogConflictApplyEntryResult[] = [];
  const readyTranslation: Array<{ input: CatalogConflictApplyEntryInput; field: CatalogConflictField }> = [];
  const readyCommerce: Array<{ input: CatalogConflictApplyEntryInput; field: CatalogConflictField }> = [];
  const readyPresence: Array<{ input: CatalogConflictApplyEntryInput; field: CatalogConflictField }> = [];
  const readyAdopt: Array<{ input: CatalogConflictApplyEntryInput; field: CatalogConflictField }> = [];

  if (entries.some((entry) => entry.fieldKey === "presence:product")) {
    await scanAndSaveCatalogPresence(null);
  }

  const productIds = [...new Set(entries.map((entry) => entry.productId))];
  const conflictsByProduct = new Map(
    await Promise.all(
      productIds.map(async (productId) => [
        productId,
        await loadProductConflictForApply(productId, actorUsername),
      ] as const),
    ),
  );

  for (const entry of entries) {
    const conflict = conflictsByProduct.get(entry.productId);
    const field = conflict?.fields.find((candidate) => candidate.fieldKey === entry.fieldKey);
    if (!field) {
      results.push(sharedStaleResult(entry, "productId", "This conflict no longer exists — it may already have been resolved."));
      continue;
    }
    // Presence Pull skips fingerprint match; Remove refuses on identity drift.
    const isPresenceRemove = field.origin === "PRESENCE"
      && field.presenceDifference?.kind === "SYNARAVA_ONLY"
      && entry.direction === "SYNARAVA_TO_SHOPIFY";
    const fingerprintsStale = field.localFingerprint !== entry.expectedLocalFingerprint
      || field.shopifyFingerprint !== entry.expectedShopifyFingerprint;
    if (
      (field.origin !== "PRESENCE" && fingerprintsStale)
      || (isPresenceRemove && field.localFingerprint !== entry.expectedLocalFingerprint)
    ) {
      results.push(sharedStaleResult(entry, "productId", "Synarava or Shopify changed since this was reviewed. Refresh and try again."));
      continue;
    }
    if (field.origin === "COMMERCE" && !isSelectableCommerceField(field, isScopedCommerceField)) {
      results.push({ productId: entry.productId, fieldKey: entry.fieldKey, ok: false, reason: "UNSUPPORTED", message: COMMERCE_UNSUPPORTED_REASON });
      continue;
    }
    // allowedDirections is the sole apply gate; blockedReason is human copy only.
    // Stub SKU refusal lives in writeToShopify (commerce-field-apply) — one write path.
    if (!field.allowedDirections.includes(entry.direction)) {
      results.push({
        productId: entry.productId,
        fieldKey: entry.fieldKey,
        ok: false,
        reason: "UNSUPPORTED",
        message: field.blockedReason ?? sharedUnsupportedDirectionReason(field, PRODUCT_PRESENCE_UNSUPPORTED),
      });
      continue;
    }
    if (!acknowledgeClears && willClear(field, entry.direction)) {
      results.push({ productId: entry.productId, fieldKey: entry.fieldKey, ok: false, reason: "NEEDS_CLEAR_CONFIRMATION", message: "This would clear a non-empty value. Confirm clearing before applying." });
      continue;
    }
    if (field.origin === "TRANSLATION") readyTranslation.push({ input: entry, field });
    else if (field.origin === "PRESENCE") readyPresence.push({ input: entry, field });
    else if (isAdoptShopifyConflictField(field)) readyAdopt.push({ input: entry, field });
    else readyCommerce.push({ input: entry, field });
  }

  for (const { input, field } of readyAdopt) {
    try {
      const product = await db.product.findUnique({
        where: { id: input.productId },
        select: { shopifyProductId: true },
      });
      if (!product?.shopifyProductId) {
        results.push({
          productId: input.productId,
          fieldKey: input.fieldKey,
          ok: false,
          reason: "WRITE_FAILED",
          message: "This product is not linked to Shopify.",
        });
        continue;
      }
      const { leaves: leavesBefore } = await recheckEntityConflictLeaves({
        resourceType: "PRODUCT",
        resourceId: input.productId,
        requestedBy: actorUsername,
      });
      const pulled = await applyShopifyProductToSynarava(product.shopifyProductId, undefined, true);
      const intended: IntendedConflictAddress[] = leavesBefore.length > 0
        ? leavesBefore.map(intendedAddressFromLeaf)
        : [{
            entityType: "PRODUCT",
            entityId: input.productId,
            node: "base",
            fieldKey: input.fieldKey,
            label: field.label,
          }];
      const gate = await gateWriteConvergence({
        resourceType: "PRODUCT",
        resourceId: pulled.productId,
        requestedBy: actorUsername,
        leavesBefore,
        intended,
      });
      if (!gate.ok) {
        results.push({
          productId: input.productId,
          fieldKey: input.fieldKey,
          ok: false,
          reason: "WRITE_FAILED",
          message: gate.message,
        });
        continue;
      }
      results.push({
        productId: input.productId,
        fieldKey: input.fieldKey,
        ok: true,
        message: "Adopted Shopify as the Synarava commerce window.",
        localProductId: pulled.productId,
      });
    } catch (error) {
      results.push({
        productId: input.productId,
        fieldKey: input.fieldKey,
        ok: false,
        reason: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "Shopify could not be adopted into Synarava.",
      });
    }
  }

  for (const { input, field } of readyPresence) {
    if (!field.presenceDifference) {
      results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: "This catalog-presence conflict is missing its source record." });
      continue;
    }
    try {
      const linkedId = field.presenceDifference.localProductId ?? (
        isVirtualPresenceProductId(input.productId) ? null : input.productId
      );
      const leavesBefore = linkedId
        ? (await recheckEntityConflictLeaves({
            resourceType: "PRODUCT",
            resourceId: linkedId,
            requestedBy: actorUsername,
          })).leaves
        : [];
      const outcome = await applyCatalogPresenceDifference({ difference: field.presenceDifference, direction: input.direction });
      if (!outcome.ok) {
        results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: outcome.reason, message: outcome.message });
        continue;
      }
      const gateId = outcome.localProductId ?? linkedId;
      if (gateId) {
        const gate = await gateWriteConvergence({
          resourceType: "PRODUCT",
          resourceId: gateId,
          requestedBy: actorUsername,
          leavesBefore,
          intended: [{
            entityType: "PRODUCT",
            entityId: gateId,
            node: "base",
            fieldKey: input.fieldKey,
            label: field.label,
          }],
        });
        if (!gate.ok) {
          results.push({
            productId: input.productId,
            fieldKey: input.fieldKey,
            ok: false,
            reason: "WRITE_FAILED",
            message: gate.message,
          });
          continue;
        }
      }
      results.push({
        productId: input.productId,
        localProductId: outcome.localProductId,
        fieldKey: input.fieldKey,
        ok: true,
        message: outcome.message,
      });
    } catch (error) {
      results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: error instanceof Error ? error.message : "This product could not be synchronized." });
    }
  }

  for (const { input, field } of readyTranslation) {
    // claimDifference sits outside apply's try — catch so one DB failure does not drop the batch.
    try {
      const leavesBefore = isVirtualPresenceProductId(input.productId)
        ? []
        : (await recheckEntityConflictLeaves({
            resourceType: "PRODUCT",
            resourceId: input.productId,
            requestedBy: actorUsername,
          })).leaves;
      const outcome = await applyTranslationConflictChoice({
        rootEntityType: "PRODUCT",
        rootEntityId: input.productId,
        conflictFieldKey: field.fieldKey,
        choice: input.direction === "SYNARAVA_TO_SHOPIFY" ? "SYNARAVA" : "SHOPIFY",
        expectedLocalFingerprint: input.expectedLocalFingerprint,
        expectedShopifyFingerprint: input.expectedShopifyFingerprint,
        actorUsername,
      });
      if (!outcome.ok) {
        results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: outcome.message });
        continue;
      }
      if (!isVirtualPresenceProductId(input.productId)) {
        const gate = await gateWriteConvergence({
          resourceType: "PRODUCT",
          resourceId: input.productId,
          requestedBy: actorUsername,
          leavesBefore,
          intended: [{
            entityType: "PRODUCT",
            entityId: input.productId,
            node: field.scope.kind === "LOCALE"
              ? treeNodeForLocale(field.scope.code)
              : "base",
            fieldKey: input.fieldKey,
            label: field.label,
          }],
        });
        if (!gate.ok) {
          results.push({
            productId: input.productId,
            fieldKey: input.fieldKey,
            ok: false,
            reason: "WRITE_FAILED",
            message: gate.message,
          });
          continue;
        }
      }
      results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: true, message: outcome.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "This change could not be applied.";
      results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message });
    }
  }

  const mediaByProduct = new Map<string, Array<{ input: CatalogConflictApplyEntryInput; field: CatalogConflictField }>>();
  const otherCommerce: Array<{ input: CatalogConflictApplyEntryInput; field: CatalogConflictField }> = [];
  for (const item of readyCommerce) {
    if (isMediaIdentityContractKey(item.field.contractKey)) {
      const list = mediaByProduct.get(item.input.productId) ?? [];
      list.push(item);
      mediaByProduct.set(item.input.productId, list);
    } else {
      otherCommerce.push(item);
    }
  }

  for (const [productId, batch] of mediaByProduct) {
    try {
      const { leaves: leavesBefore } = await recheckEntityConflictLeaves({
        resourceType: "PRODUCT",
        resourceId: productId,
        requestedBy: actorUsername,
      });
      const outcome = await applyMediaIdentityBatch({
        productId,
        requestedBy: actorUsername,
        leavesBefore,
        entries: batch.map(({ input, field }) => ({
          fieldKey: input.fieldKey,
          label: field.label,
          path: field.path ?? null,
          contractKey: field.contractKey ?? null,
          direction: input.direction,
          expectedLocalFingerprint: input.expectedLocalFingerprint,
          expectedShopifyFingerprint: input.expectedShopifyFingerprint,
        })),
      });
      for (const { input } of batch) {
        results.push(
          outcome.ok
            ? { productId, fieldKey: input.fieldKey, ok: true, message: "Media conflict applied." }
            : { productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: outcome.message },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "This change could not be applied.";
      for (const { input } of batch) {
        results.push({ productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message });
      }
    }
  }

  for (const { input, field } of otherCommerce) {
    try {
      const outcome = await applyCommerceField({
        productId: input.productId,
        label: field.label,
        fieldKey: field.fieldKey,
        direction: input.direction,
        expectedLocalFingerprint: input.expectedLocalFingerprint,
        expectedShopifyFingerprint: input.expectedShopifyFingerprint,
        requestedBy: actorUsername,
      });
      results.push(
        outcome.ok
          ? { productId: input.productId, fieldKey: input.fieldKey, ok: true, message: outcome.message }
          : { productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: outcome.reason, message: outcome.message },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "This change could not be applied.";
      results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message });
    }
  }

  return summarizeApplyOutcome(results);
}
