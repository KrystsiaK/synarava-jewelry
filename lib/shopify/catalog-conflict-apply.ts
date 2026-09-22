import "server-only";

import { db } from "@/lib/db";

import {
  getProductCatalogConflict,
  listConflictedProductIds,
  type CatalogConflictDirection,
  type CatalogConflictField,
} from "./catalog-conflict";
import { pullShopifyProduct, pushProductToShopify } from "./product-sync";
import { applyReconcileChoice } from "./reconciliation-apply";

// A bulk scope resolves every currently conflicted product — capped so one
// request can't try to preview/apply an unbounded catalog in one go. A
// product with many conflicting fields still contributes all of them; this
// only bounds how many *products* a single bulk operation touches.
const MAX_BULK_PRODUCTS = 50;
// Hard ceiling on how many field-level entries one applyCatalogConflictResolution
// call will attempt, regardless of scope shape (bulk, product, or hand-picked
// manual selections) — a defensive bound on request size, not a tuned value.
const MAX_APPLY_ENTRIES = 200;

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

/**
 * Resolves a scope into the concrete fields it would touch — the same
 * function backs a bulk direction, a single product's direction, and a
 * hand-picked manual field list, so preview and apply always agree on what
 * "this scope" means. Fields whose direction isn't allowed, that are no
 * longer conflicting, or that would mix directions across a single
 * product's commerce fields (commerce applies atomically per product — see
 * catalog-conflict-resolution-plan.md stage 1's open note) are reported in
 * `excluded`, never silently dropped.
 */
export async function previewCatalogConflictResolution(scope: CatalogConflictApplyScope): Promise<CatalogConflictPreview> {
  const entries: ResolvedCatalogConflictEntry[] = [];
  const excluded: ExcludedCatalogConflictEntry[] = [];
  let truncated = false;
  // Tracked across every resolveProductDirection call for a product — a
  // MANUAL scope can call it once per requested direction, and the mixed-
  // direction check must see all of a product's commerce selections
  // together, not just the ones in whichever direction group ran last.
  const commerceDirectionByProduct = new Map<string, CatalogConflictDirection>();

  async function resolveProductDirection(productId: string, direction: CatalogConflictDirection, onlyFieldKeys?: Set<string>) {
    const conflict = await getProductCatalogConflict(productId);
    for (const field of conflict.fields) {
      if (onlyFieldKeys && !onlyFieldKeys.has(field.fieldKey)) continue;
      if (!field.allowedDirections.includes(direction)) {
        excluded.push({ productId, fieldKey: field.fieldKey, label: field.label, reason: field.blockedReason ?? "This direction isn't supported for this field." });
        continue;
      }
      if (field.blockedReason) {
        excluded.push({ productId, fieldKey: field.fieldKey, label: field.label, reason: field.blockedReason });
        continue;
      }
      if (field.origin === "COMMERCE") {
        const takenDirection = commerceDirectionByProduct.get(productId);
        if (takenDirection && takenDirection !== direction) {
          excluded.push({
            productId,
            fieldKey: field.fieldKey,
            label: field.label,
            reason: "Commerce fields apply together in one direction per product; this field's direction conflicts with another commerce field already chosen for this product.",
          });
          continue;
        }
        commerceDirectionByProduct.set(productId, direction);
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
 * skipped rather than overwritten. Commerce entries for the same
 * (product, direction) are grouped and written with exactly one
 * whole-product push/pull — Shopify is the source of truth for commerce
 * and inspectProductSyncState only tells us the product differs, not which
 * field caused it, so a scoped commerce write cannot yet touch one field
 * without the others (see catalog-conflict-resolution-plan.md stage 1's
 * open note); this keeps that limitation honest instead of pretending
 * per-field commerce granularity that doesn't exist. Translation entries
 * apply individually through the existing per-field applyReconcileChoice.
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
  const readyCommerceByProductDirection = new Map<string, { productId: string; direction: CatalogConflictDirection; inputs: CatalogConflictApplyEntryInput[] }>();

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
    if (field.localFingerprint !== entry.expectedLocalFingerprint || field.shopifyFingerprint !== entry.expectedShopifyFingerprint) {
      results.push(staleResult(entry, "Synarava or Shopify changed since this was reviewed. Refresh and try again."));
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

    if (field.origin === "TRANSLATION") {
      readyTranslation.push({ input: entry, field });
    } else {
      const key = `${entry.productId}:${entry.direction}`;
      const group = readyCommerceByProductDirection.get(key) ?? { productId: entry.productId, direction: entry.direction, inputs: [] };
      group.inputs.push(entry);
      readyCommerceByProductDirection.set(key, group);
    }
  }

  for (const { input, field } of readyTranslation) {
    if (!field.sourceId) {
      results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: "This translated field is missing its source record." });
      continue;
    }
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
  }

  for (const group of readyCommerceByProductDirection.values()) {
    try {
      if (group.direction === "SYNARAVA_TO_SHOPIFY") {
        const pushResult = await pushProductToShopify(group.productId, true);
        for (const input of group.inputs) {
          results.push(
            pushResult.ok
              ? { productId: input.productId, fieldKey: input.fieldKey, ok: true, message: "Synarava was applied to Shopify." }
              : { productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: pushResult.error },
          );
        }
      } else {
        const product = await db.product.findUnique({ where: { id: group.productId }, select: { shopifyProductId: true } });
        if (!product?.shopifyProductId) {
          for (const input of group.inputs) {
            results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: "This product is not linked to Shopify." });
          }
          continue;
        }
        const pullResult = await pullShopifyProduct(product.shopifyProductId, undefined, true);
        for (const input of group.inputs) {
          results.push(
            pullResult.status === "SYNCED"
              ? { productId: input.productId, fieldKey: input.fieldKey, ok: true, message: "Shopify was applied to Synarava." }
              : { productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message: `Shopify pull ended in ${pullResult.status}.` },
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shopify write failed.";
      for (const input of group.inputs) {
        results.push({ productId: input.productId, fieldKey: input.fieldKey, ok: false, reason: "WRITE_FAILED", message });
      }
    }
  }

  const failedCount = results.filter((result) => !result.ok).length;
  return { results, appliedCount: results.length - failedCount, failedCount };
}
