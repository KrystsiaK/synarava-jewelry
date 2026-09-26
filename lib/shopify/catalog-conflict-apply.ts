import "server-only";

import {
  getProductCatalogConflict,
  listConflictedProductIds,
  type CatalogConflictDirection,
  type CatalogConflictField,
} from "./catalog-conflict";
import { applyCommerceField } from "./commerce-field-apply";
import { COMMERCE_UNSUPPORTED_REASON, SCOPED_COMMERCE_FIELD_LABELS } from "./catalog-conflict-policy";
import { applyReconcileChoice } from "./reconciliation-apply";
import { applyCatalogPresenceDifference, scanAndSaveCatalogPresence } from "./catalog-presence-server";

// A bulk scope resolves every currently conflicted product — capped so one
// request can't try to preview/apply an unbounded catalog in one go. A
// product with many conflicting fields still contributes all of them; this
// only bounds how many *products* a single bulk operation touches.
const MAX_BULK_PRODUCTS = 50;
// Hard ceiling on how many field-level entries one applyCatalogConflictResolution
// call will attempt, regardless of scope shape (bulk, product, or hand-picked
// manual selections) — a defensive bound on request size, not a tuned value.
const MAX_APPLY_ENTRIES = 200;

// Most commerce fields still have no safe scoped write: pushProductToShopify
// and pullShopifyProduct are whole-product — a forced push/pull rewrites
// every commerce field *and* every published locale's translation (see their
// own per-locale loops in product-sync.ts), using a conflict check
// (decideProductTranslationPull / push's inline per-locale fetch+compare)
// that is a *separate* code path from the reconcile system this module's
// read model (getProductCatalogConflict) is built on. That combination is
// why those two functions stay off-limits here. A narrow slice of plain
// scalar fields (SCOPED_COMMERCE_FIELD_LABELS, in commerce-field-apply.ts —
// Vendor, Product type, Variant SKU, Price, Compare-at price, Charge tax) instead has
// its own single-field Shopify mutation (productUpdate/
// productVariantsBulkUpdate with only that key) and a single-column Prisma
// write — no other field is touched. Everything else stays UNSUPPORTED.
// Whole-product commerce/translation resolution for one product remains
// available through the existing
// pushSingleProductToShopifyAction/pullSingleProductFromShopifyAction — but
// not from inside this contract's dialogs (see catalog-conflict-resolution-plan.md stage 2).
function isScopedCommerceField(field: CatalogConflictField): boolean {
  return field.origin === "COMMERCE" && SCOPED_COMMERCE_FIELD_LABELS.has(field.label);
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

export type CatalogConflictPreview = {
  entries: ResolvedCatalogConflictEntry[];
  excluded: ExcludedCatalogConflictEntry[];
  /** True when a BULK scope had more conflicted products than MAX_BULK_PRODUCTS and was cut off. */
  truncated: boolean;
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

function unsupportedDirectionReason(field: CatalogConflictField): string {
  if (field.origin === "PRESENCE") {
    return field.presenceDifference?.kind === "SHOPIFY_ONLY"
      ? "This product only exists in Shopify. Pull it first, or run the Shopify → Synarava bulk action."
      : "This product only exists in Synarava. Push it first, or run the Synarava → Shopify bulk action.";
  }
  return field.blockedReason ?? "This direction isn't supported for this field.";
}

/**
 * Resolves a scope into the concrete fields it would touch — the same
 * function backs a bulk direction, a single product's direction, and a
 * hand-picked manual field list, so preview and apply always agree on what
 * "this scope" means. Fields whose direction isn't allowed, that are no
 * longer conflicting, or that are COMMERCE-origin outside
 * SCOPED_COMMERCE_FIELD_LABELS (see COMMERCE_UNSUPPORTED_REASON above) are
 * reported in `excluded`, never silently dropped.
 */
export async function previewCatalogConflictResolution(scope: CatalogConflictApplyScope): Promise<CatalogConflictPreview> {
  const entries: ResolvedCatalogConflictEntry[] = [];
  const excluded: ExcludedCatalogConflictEntry[] = [];
  let truncated = false;

  async function resolveProductDirection(productId: string, direction: CatalogConflictDirection, onlyFieldKeys?: Set<string>) {
    const conflict = await getProductCatalogConflict(productId);
    for (const field of conflict.fields) {
      if (onlyFieldKeys && !onlyFieldKeys.has(field.fieldKey)) continue;
      if (field.origin === "COMMERCE" && !isScopedCommerceField(field)) {
        excluded.push({ productId, fieldKey: field.fieldKey, label: field.label, reason: COMMERCE_UNSUPPORTED_REASON });
        continue;
      }
      if (!field.allowedDirections.includes(direction)) {
        excluded.push({ productId, fieldKey: field.fieldKey, label: field.label, reason: unsupportedDirectionReason(field) });
        continue;
      }
      if (field.blockedReason) {
        excluded.push({ productId, fieldKey: field.fieldKey, label: field.label, reason: field.blockedReason });
        continue;
      }
      entries.push({ productId, direction, field, willClearNonEmptyValue: willClear(field, direction) });
    }
  }

  if (scope.kind === "BULK") {
    const allProductIds = await listConflictedProductIds();
    const productIds = allProductIds.slice(0, MAX_BULK_PRODUCTS);
    truncated = allProductIds.length > productIds.length;
    for (const productId of productIds) await resolveProductDirection(productId, scope.direction);
  } else if (scope.kind === "PRODUCT") {
    await resolveProductDirection(scope.productId, scope.direction);
  } else {
    const selectionsByProduct = new Map<string, Array<{ fieldKey: string; direction: CatalogConflictDirection }>>();
    for (const selection of scope.selections) {
      const list = selectionsByProduct.get(selection.productId) ?? [];
      list.push(selection);
      selectionsByProduct.set(selection.productId, list);
    }
    for (const [productId, selections] of selectionsByProduct) {
      const conflict = await getProductCatalogConflict(productId);
      const currentFieldKeys = new Set(conflict.fields.map((field) => field.fieldKey));
      for (const selection of selections) {
        if (!currentFieldKeys.has(selection.fieldKey)) {
          excluded.push({ productId, fieldKey: selection.fieldKey, label: selection.fieldKey, reason: "This field is no longer conflicting." });
        }
      }
      const byDirection = new Map<CatalogConflictDirection, Set<string>>();
      for (const selection of selections) {
        const set = byDirection.get(selection.direction) ?? new Set<string>();
        set.add(selection.fieldKey);
        byDirection.set(selection.direction, set);
      }
      for (const [direction, fieldKeys] of byDirection) await resolveProductDirection(productId, direction, fieldKeys);
    }
  }

  return { entries: entries.slice(0, MAX_APPLY_ENTRIES), excluded, truncated: truncated || entries.length > MAX_APPLY_ENTRIES };
}

export type CatalogConflictApplyEntryInput = {
  productId: string;
  fieldKey: string;
  direction: CatalogConflictDirection;
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
};

export type CatalogConflictApplyEntryResult = {
  productId: string;
  fieldKey: string;
  ok: boolean;
  reason?: "STALE" | "NEEDS_CLEAR_CONFIRMATION" | "WRITE_FAILED" | "UNSUPPORTED";
  message: string;
  localProductId?: string;
};

export type CatalogConflictApplyOutcome = {
  results: CatalogConflictApplyEntryResult[];
  appliedCount: number;
  failedCount: number;
};

function staleResult(entry: CatalogConflictApplyEntryInput, message: string): CatalogConflictApplyEntryResult {
  return { productId: entry.productId, fieldKey: entry.fieldKey, ok: false, reason: "STALE", message };
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
  if (entries.length > MAX_APPLY_ENTRIES) {
    throw new Error(`Too many changes in one batch (${entries.length}); max is ${MAX_APPLY_ENTRIES}.`);
  }

  const results: CatalogConflictApplyEntryResult[] = [];
  const readyTranslation: Array<{ input: CatalogConflictApplyEntryInput; field: CatalogConflictField }> = [];
  const readyCommerce: Array<{ input: CatalogConflictApplyEntryInput; field: CatalogConflictField }> = [];
  const readyPresence: Array<{ input: CatalogConflictApplyEntryInput; field: CatalogConflictField }> = [];

  if (entries.some((entry) => entry.fieldKey === "presence:product")) {
    await scanAndSaveCatalogPresence(null);
  }

  const productIds = [...new Set(entries.map((entry) => entry.productId))];
  const conflictsByProduct = new Map(
    await Promise.all(productIds.map(async (productId) => [productId, await getProductCatalogConflict(productId)] as const)),
  );

  for (const entry of entries) {
    const conflict = conflictsByProduct.get(entry.productId);
    const field = conflict?.fields.find((candidate) => candidate.fieldKey === entry.fieldKey);
    if (!field) {
      results.push(staleResult(entry, "This conflict no longer exists — it may already have been resolved."));
      continue;
    }
    // Presence freshness is the re-scan above: if the membership row is still
    // present with an allowed direction, apply the *current* difference.
    // Comparing preview fingerprints to post-scan hashes is wrong here —
    // preview reads a saved snapshot, apply re-scans live; title/updatedAt
    // schema churn or SKU rematch change hashes without invalidating Pull.
    // Field conflicts (commerce/translation) still require fingerprint match.
    if (
      field.origin !== "PRESENCE"
      && (field.localFingerprint !== entry.expectedLocalFingerprint
        || field.shopifyFingerprint !== entry.expectedShopifyFingerprint)
    ) {
      results.push(staleResult(entry, "Synarava or Shopify changed since this was reviewed. Refresh and try again."));
      continue;
    }
    if (field.origin === "COMMERCE" && !isScopedCommerceField(field)) {
      results.push({ productId: entry.productId, fieldKey: entry.fieldKey, ok: false, reason: "UNSUPPORTED", message: COMMERCE_UNSUPPORTED_REASON });
      continue;
    }
    if (!field.allowedDirections.includes(entry.direction) || field.blockedReason) {
      results.push({ productId: entry.productId, fieldKey: entry.fieldKey, ok: false, reason: "UNSUPPORTED", message: field.blockedReason ?? "This direction isn't supported for this field." });
      continue;
    }
    if (!acknowledgeClears && willClear(field, entry.direction)) {
      results.push({ productId: entry.productId, fieldKey: entry.fieldKey, ok: false, reason: "NEEDS_CLEAR_CONFIRMATION", message: "This would clear a non-empty value. Confirm clearing before applying." });
      continue;
    }
    if (field.origin === "TRANSLATION") readyTranslation.push({ input: entry, field });
    else if (field.origin === "PRESENCE") readyPresence.push({ input: entry, field });
    else readyCommerce.push({ input: entry, field });
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

  const failedCount = results.filter((result) => !result.ok).length;
  return { results, appliedCount: results.length - failedCount, failedCount };
}
