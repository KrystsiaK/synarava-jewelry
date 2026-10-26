import "server-only";

import { db } from "@/lib/db";

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
import { COMMERCE_UNSUPPORTED_REASON, isScopedCommerceFieldLabel } from "./catalog-conflict-policy";
import { applyCatalogPresenceDifference, scanAndSaveCatalogPresence } from "./catalog-presence-server";
import { applyShopifyProductToSynarava, inspectProductSyncState } from "./product-sync";
import { applyReconcileChoice } from "./reconciliation-apply";

function isVirtualPresenceProductId(productId: string): boolean {
  return productId.startsWith("shopify:");
}

/**
 * Re-read conflict fields for apply/preview safety.
 * Live Shopify inspect for a linked local product is the ONLY allowed network
 * fetch on this path — then map persisted SyncResult leaves (skipRefresh).
 */
async function loadProductConflictForApply(
  productId: string,
  requestedBy: string,
): Promise<ProductCatalogConflict> {
  if (!isVirtualPresenceProductId(productId)) {
    // ONLY allowed live Shopify inspect for conflict apply safety.
    try {
      await inspectProductSyncState(productId);
    } catch {
      // Missing/unlinked product → empty fields / STALE below.
    }
  }
  return loadProductConflictFromSyncResult(productId, {
    requestedBy,
    skipRefresh: true,
  });
}

export type WholeRecordFingerprintExpectation = {
  fieldKey: string;
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
};

/**
 * Same stale-fingerprint gate Apply uses, for whole-record pull/push:
 * preview showed these blocked commerce fields; refuse if any changed.
 */
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

// A bulk scope resolves every currently conflicted product — capped so one
// request can't try to preview/apply an unbounded catalog in one go. A
// product with many conflicting fields still contributes all of them; this
// only bounds how many *products* a single bulk operation touches.
const MAX_BULK_PRODUCTS = 50;

// Most commerce fields still have no safe scoped write: pushProductToShopify
// and applyShopifyProductToSynarava are whole-product — a forced push/pull rewrites
// every commerce field *and* every published locale's translation (see their
// own per-locale loops in product-sync.ts), using a conflict check
// (decideProductTranslationPull / push's inline per-locale fetch+compare)
// that is a *separate* code path from the reconcile system this module's
// read model (SyncResult leaves) is built on. That combination is why those
// two functions stay off-limits here for structural fields except Media
// (adopt `media` / push pipeline via applyCommerceField). A narrow slice of
// plain scalar fields (SCOPED_COMMERCE_FIELD_LABELS — Name, Handle, Vendor,
// Product type, Variant SKU, Price, Compare-at, Charge tax) plus Media
// gallery labels instead has its own writer. Status, tags, collections,
// category stay UNSUPPORTED; Field Decisions offers inline whole-record
// Pull/Push for those.
function isScopedCommerceField(field: CatalogConflictField): boolean {
  return field.origin === "COMMERCE" && isScopedCommerceFieldLabel(field.label);
}

function isProductSelectableCommerceField(field: CatalogConflictField): boolean {
  return isSelectableCommerceField(field, isScopedCommerceField);
}

function unsupportedDirectionReason(field: CatalogConflictField): string {
  return sharedUnsupportedDirectionReason(field, PRODUCT_PRESENCE_UNSUPPORTED);
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

/**
 * Resolves a scope into the concrete fields it would touch — the same
 * function backs a bulk direction, a single product's direction, and a
 * hand-picked manual field list, so preview and apply always agree on what
 * "this scope" means. Fields whose direction isn't allowed, that are no
 * longer conflicting, or that are COMMERCE-origin outside
 * SCOPED_COMMERCE_FIELD_LABELS (see COMMERCE_UNSUPPORTED_REASON above) are
 * reported in `excluded`, never silently dropped.
 */
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
      if (field.origin === "COMMERCE" && !isProductSelectableCommerceField(field)) {
        return { kind: "exclude", reason: COMMERCE_UNSUPPORTED_REASON };
      }
      if (!field.allowedDirections.includes(direction)) {
        return { kind: "exclude", reason: unsupportedDirectionReason(field) };
      }
      if (field.blockedReason) {
        return { kind: "exclude", reason: field.blockedReason };
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

function staleResult(entry: CatalogConflictApplyEntryInput, message: string): CatalogConflictApplyEntryResult {
  return sharedStaleResult(entry, "productId", message);
}

/**
 * Re-validates every requested entry against the product's current
 * conflict state right before writing anything — the client's expected
 * fingerprints must still match, or the entry is reported STALE and
 * skipped rather than overwritten.
 *
 * TRANSLATION-origin fields apply individually through the existing
 * per-field applyReconcileChoice (already atomic, fingerprint-checked, and
 * verified by a read-after-write). COMMERCE-origin fields apply through
 * applyCommerceField only when their label is in
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
      results.push(staleResult(entry, "This conflict no longer exists — it may already have been resolved."));
      continue;
    }
    // Presence Pull (SHOPIFY_ONLY): re-scan may rematch SKU/handle and change
    // hashes without invalidating Pull — skip fingerprint match there.
    // Presence Remove (SYNARAVA_ONLY → Synarava→Shopify): refuse when the
    // identity fingerprint (id + handle + shopify id) changed since preview.
    // Commerce/translation always require fingerprint match.
    const isPresenceRemove = field.origin === "PRESENCE"
      && field.presenceDifference?.kind === "SYNARAVA_ONLY"
      && entry.direction === "SYNARAVA_TO_SHOPIFY";
    const fingerprintsStale = field.localFingerprint !== entry.expectedLocalFingerprint
      || field.shopifyFingerprint !== entry.expectedShopifyFingerprint;
    if (
      (field.origin !== "PRESENCE" && fingerprintsStale)
      || (isPresenceRemove && field.localFingerprint !== entry.expectedLocalFingerprint)
    ) {
      results.push(staleResult(entry, "Synarava or Shopify changed since this was reviewed. Refresh and try again."));
      continue;
    }
    if (field.origin === "COMMERCE" && !isProductSelectableCommerceField(field)) {
      results.push({ productId: entry.productId, fieldKey: entry.fieldKey, ok: false, reason: "UNSUPPORTED", message: COMMERCE_UNSUPPORTED_REASON });
      continue;
    }
    if (!field.allowedDirections.includes(entry.direction) || field.blockedReason) {
      results.push({ productId: entry.productId, fieldKey: entry.fieldKey, ok: false, reason: "UNSUPPORTED", message: field.blockedReason ?? unsupportedDirectionReason(field) });
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

  for (const { input } of readyAdopt) {
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
      const pulled = await applyShopifyProductToSynarava(product.shopifyProductId, undefined, true);
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
      const outcome = await applyCatalogPresenceDifference({ difference: field.presenceDifference, direction: input.direction });
      results.push(outcome.ok
        ? { productId: input.productId, localProductId: outcome.localProductId, fieldKey: input.fieldKey, ok: true, message: outcome.message }
        : { productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: outcome.reason, message: outcome.message });
    } catch (error) {
      results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: error instanceof Error ? error.message : "This product could not be synchronized." });
    }
  }

  for (const { input, field } of readyTranslation) {
    if (!field.sourceId) {
      results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: "This translated field is missing its source record." });
      continue;
    }
    // applyReconcileChoice can throw before it even reaches its own internal
    // try (claimDifference runs outside it — a DB hiccup there throws
    // straight out). Without a try/catch here, one such failure mid-batch
    // would reject applyCatalogConflictResolution entirely, discarding every
    // already-computed result — including fields already applied
    // successfully earlier in this same loop — instead of reporting this
    // one field as failed and letting the rest of the batch stand.
    try {
      const outcome = await applyReconcileChoice({
        divergenceId: field.sourceId,
        choice: input.direction === "SYNARAVA_TO_SHOPIFY" ? "SYNARAVA" : "SHOPIFY",
        expectedLocalFingerprint: input.expectedLocalFingerprint,
        expectedShopifyFingerprint: input.expectedShopifyFingerprint,
        actorUsername,
      });
      results.push(
        outcome.ok
          ? { productId: input.productId, fieldKey: input.fieldKey, ok: true, message: outcome.message }
          : { productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: outcome.message },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "This change could not be applied.";
      results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message });
    }
  }

  for (const { input, field } of readyCommerce) {
    // applyCommerceField re-validates against a *fresh* live inspection
    // immediately before writing (closing the window since this loop's own
    // batch-level fingerprint check above), so its own fingerprint inputs
    // are passed straight through rather than the (by-then-possibly-stale)
    // field snapshot this loop fetched earlier. It catches its own write
    // errors and returns {ok:false}, but wrapped defensively anyway so a
    // bug there can never take the rest of this batch down with it (same
    // reasoning as the translation loop above).
    try {
      const outcome = await applyCommerceField({
        productId: input.productId,
        label: field.label,
        direction: input.direction,
        expectedLocalFingerprint: input.expectedLocalFingerprint,
        expectedShopifyFingerprint: input.expectedShopifyFingerprint,
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
