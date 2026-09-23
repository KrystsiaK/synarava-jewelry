import "server-only";

import { db } from "@/lib/db";
import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";

import { commerceFingerprint } from "./catalog-conflict";
import { fetchShopifyProduct, inspectProductSyncState } from "./product-sync";

type UserError = { field?: string[] | null; message: string };

/**
 * Commerce fields safe to apply individually right now: plain scalars on
 * the product or its single variant, with a Shopify mutation that accepts
 * a partial input (only the changed key), so nothing else on the product
 * is read back or rewritten. Their inspectProductSyncState label carries a
 * " (SKU)" suffix once Shopify reports more than one variant (see
 * product-sync.ts's variantSuffix) — that suffixed label never matches
 * this set. A local product with more than one variant row (even against
 * a single Shopify variant) is caught separately, at write time, by
 * resolveSingleVariantPair below — see the "several local variants, one
 * Shopify variant" case that label-suffix checking alone cannot catch.
 *
 * Left out of this first slice: Status (Product.status has a fourth,
 * Synarava-only "UNLISTED" value with no Shopify equivalent — it's coupled
 * to the online-store publication toggle, not a plain scalar), Synarava
 * storefront visibility (derived from status + publication), Product
 * category (taxonomy id, its own input shape), Tags/Collections/Media/
 * Characteristics (array-shaped, need real merge semantics). Each needs its
 * own design, not a slot in this set.
 */
export const SCOPED_COMMERCE_FIELD_LABELS = new Set([
  "Vendor",
  "Product type",
  "Variant SKU",
  "Price",
  "Compare-at price",
]);

const VARIANT_FIELD_LABELS = new Set(["Variant SKU", "Price", "Compare-at price"]);

export type CommerceFieldApplyResult =
  | { ok: true; message: string }
  | { ok: false; reason: "STALE" | "UNSUPPORTED" | "WRITE_FAILED"; message: string };

/** `inspectProductSyncState`/`compare()` renders an empty value as "—"; this reverses that back to the real value to write. */
function rawValue(displayValue: string): string {
  return displayValue === "—" ? "" : displayValue;
}

function throwOnUserErrors(errors: UserError[]) {
  if (errors.length > 0) throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
}

type VariantPair = { localVariantId: string; shopifyVariantId: string };

/**
 * Resolves the one local variant and one Shopify variant a SKU/Price/
 * Compare-at price conflict refers to. Returns null — never a guess —
 * whenever that pairing isn't unambiguous: more than one local variant row
 * (even if Shopify currently shows only one, e.g. stale/duplicate local
 * data), or Shopify itself reporting more than one variant. The caller
 * turns a null into UNSUPPORTED rather than writing to a possibly-wrong
 * variant.
 */
async function resolveSingleVariantPair(productId: string): Promise<VariantPair | null> {
  const localVariants = await db.productVariant.findMany({ where: { productId }, select: { id: true } });
  if (localVariants.length !== 1) return null;

  const product = await db.product.findUnique({ where: { id: productId }, select: { shopifyProductId: true } });
  if (!product?.shopifyProductId) return null;

  const remote = await fetchShopifyProduct(product.shopifyProductId);
  if (!remote || remote.variants.nodes.length !== 1) return null;

  return { localVariantId: localVariants[0].id, shopifyVariantId: remote.variants.nodes[0].id };
}

async function writeLocally(productId: string, label: string, value: string, variant: VariantPair | null) {
  if (label === "Vendor") {
    const updated = await db.product.update({ where: { id: productId }, data: { vendor: value || null } });
    if (updated.vendor !== (value || null)) throw new Error("Local write did not take effect as expected.");
    return;
  }
  if (label === "Product type") {
    const updated = await db.product.update({ where: { id: productId }, data: { productType: value || null } });
    if (updated.productType !== (value || null)) throw new Error("Local write did not take effect as expected.");
    return;
  }
  if (!variant) throw new Error("This product's variant could not be determined.");
  if (label === "Variant SKU") {
    const updated = await db.productVariant.update({ where: { id: variant.localVariantId }, data: { sku: value } });
    if (updated.sku !== value) throw new Error("Local write did not take effect as expected.");
    return;
  }
  if (label === "Price") {
    const updated = await db.productVariant.update({ where: { id: variant.localVariantId }, data: { priceCents: Number(value) } });
    if (updated.priceCents !== Number(value)) throw new Error("Local write did not take effect as expected.");
    return;
  }
  if (label === "Compare-at price") {
    const nextValue = value ? Number(value) : null;
    const updated = await db.productVariant.update({ where: { id: variant.localVariantId }, data: { compareAtCents: nextValue } });
    if (updated.compareAtCents !== nextValue) throw new Error("Local write did not take effect as expected.");
    return;
  }
  throw new Error(`${label} is not a supported commerce field.`);
}

async function writeToShopify(productId: string, label: string, value: string, variant: VariantPair | null) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { shopifyProductId: true } });
  if (!product?.shopifyProductId) throw new Error("This product is not linked to Shopify.");

  if (label === "Vendor" || label === "Product type") {
    const key = label === "Vendor" ? "vendor" : "productType";
    const result = await shopifyAdminRequest<{
      productUpdate: { product: { id: string; vendor: string | null; productType: string | null } | null; userErrors: UserError[] };
    }>(
      `mutation SynaravaCommerceFieldUpdate($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product { id vendor productType }
          userErrors { field message }
        }
      }`,
      { product: { id: product.shopifyProductId, [key]: value } },
    );
    throwOnUserErrors(result.productUpdate.userErrors);
    const saved = result.productUpdate.product;
    if (!saved) throw new ShopifyAdminError("Shopify did not return the updated product.");
    const savedValue = key === "vendor" ? saved.vendor : saved.productType;
    if ((savedValue ?? "") !== value) throw new ShopifyAdminError("Shopify accepted the request but the read-back value did not match. Nothing is marked resolved.");
    return;
  }

  if (label === "Variant SKU" || label === "Price" || label === "Compare-at price") {
    if (!variant) throw new Error("This product's variant could not be determined.");
    const input: Record<string, unknown> = { id: variant.shopifyVariantId };
    if (label === "Price") input.price = (Number(value) / 100).toFixed(2);
    else if (label === "Compare-at price") input.compareAtPrice = value ? (Number(value) / 100).toFixed(2) : null;
    else input.inventoryItem = { sku: value };

    const result = await shopifyAdminRequest<{
      productVariantsBulkUpdate: {
        productVariants: Array<{ id: string; price: string; compareAtPrice: string | null; inventoryItem: { sku: string | null } }>;
        userErrors: UserError[];
      };
    }>(
      `mutation SynaravaCommerceVariantUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id price compareAtPrice inventoryItem { sku } }
          userErrors { field message }
        }
      }`,
      { productId: product.shopifyProductId, variants: [input] },
    );
    throwOnUserErrors(result.productVariantsBulkUpdate.userErrors);
    const saved = result.productVariantsBulkUpdate.productVariants[0];
    if (!saved) throw new ShopifyAdminError("Shopify did not return the updated variant.");
    const readBackMatches = label === "Variant SKU" ? (saved.inventoryItem.sku ?? "") === value
      : label === "Price" ? saved.price === (Number(value) / 100).toFixed(2)
        : (saved.compareAtPrice ?? "") === (value ? (Number(value) / 100).toFixed(2) : "");
    if (!readBackMatches) throw new ShopifyAdminError("Shopify accepted the request but the read-back value did not match. Nothing is marked resolved.");
    return;
  }

  throw new Error(`${label} is not a supported commerce field.`);
}

/**
 * Recomputes this product's true sync state right after a successful
 * field write and persists it — the catalog-wide conflict list
 * (listConflictedProductIds) reads the *persisted* `syncStatus` flag, not
 * a live check, so a field-level fix that isn't written back here would
 * leave an already-resolved product showing as conflicted forever.
 *
 * Deliberately keys off `inspection.differences.length`, not
 * `inspection.state`: inspectProductSyncState derives `state` partly from
 * the *persisted* `syncStatus`/`shopifyUpdatedAt` columns this function
 * exists to fix, and partly from a timestamp check
 * (`remote.updatedAt > local.shopifyUpdatedAt`) that Shopify's own mutation
 * just bumped. Right after this write resolves the *only* remaining
 * difference, both of those stale columns still read as before — the
 * persisted `syncStatus` is still "CONFLICT" and `shopifyUpdatedAt` is
 * still older than the just-mutated `remote.updatedAt` — so `state` comes
 * back "CONFLICT" even with an empty `differences` list. Trusting `state`
 * here would leave a fully-resolved product stuck showing a conflict
 * badge forever. `differences.length === 0` is the actual ground truth:
 * nothing left to reconcile, regardless of what those two stale columns
 * say — and this call itself corrects them by writing the fresh
 * `remoteUpdatedAt` back.
 *
 * UNLINKED/REMOTE_MISSING mean the comparison itself couldn't run (no
 * Shopify link, or the remote product is gone) — `differences` is also
 * empty there, but for a different reason, so those are left untouched
 * rather than misreported as SYNCED.
 */
async function refreshProductSyncStatus(productId: string) {
  const inspection = await inspectProductSyncState(productId);
  if (inspection.state === "UNLINKED" || inspection.state === "REMOTE_MISSING") return;
  if (inspection.differences.length > 0) return;
  await db.product.update({
    where: { id: productId },
    data: {
      syncStatus: "SYNCED",
      syncError: null,
      ...(inspection.remoteUpdatedAt ? { shopifyUpdatedAt: new Date(inspection.remoteUpdatedAt) } : {}),
      lastSyncedAt: new Date(),
    },
  });
}

/**
 * Applies one commerce field in one direction — re-validated against a
 * fresh live inspection immediately before writing, not just against
 * whatever the caller last saw in preview. This closes the window between
 * preview and this call: if Shopify or Synarava changed in between (or a
 * concurrent apply already resolved it), this reports STALE and writes
 * nothing, instead of trusting stale values passed in from an earlier
 * read. SKU/Price/Compare-at price additionally require an unambiguous
 * single local variant matched to a single Shopify variant — if that
 * can't be established, the field is reported UNSUPPORTED rather than
 * guessing which variant to touch.
 *
 * After a successful write, the mutation's own response (Shopify) or the
 * Prisma update's returned row (local) is checked against the intended
 * value, and the product's persisted sync state is refreshed so a fully
 * resolved product stops showing as conflicted in the catalog list —
 * while any other, still-differing field keeps it visible.
 */
export async function applyCommerceField({
  productId,
  label,
  direction,
  expectedLocalFingerprint,
  expectedShopifyFingerprint,
}: {
  productId: string;
  label: string;
  direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
}): Promise<CommerceFieldApplyResult> {
  if (!SCOPED_COMMERCE_FIELD_LABELS.has(label)) {
    return { ok: false, reason: "UNSUPPORTED", message: `${label} is not a supported commerce field.` };
  }

  const inspection = await inspectProductSyncState(productId);
  const difference = inspection.differences.find((item) => item.field === label);
  if (!difference) {
    return { ok: false, reason: "STALE", message: "This field is no longer different — it may already have been resolved." };
  }
  if (
    commerceFingerprint(difference.local) !== expectedLocalFingerprint
    || commerceFingerprint(difference.shopify) !== expectedShopifyFingerprint
  ) {
    return { ok: false, reason: "STALE", message: "Synarava or Shopify changed since this was reviewed. Refresh and try again." };
  }

  let variant: VariantPair | null = null;
  if (VARIANT_FIELD_LABELS.has(label)) {
    variant = await resolveSingleVariantPair(productId);
    if (!variant) {
      return {
        ok: false,
        reason: "UNSUPPORTED",
        message: "This product's variant couldn't be matched unambiguously (more than one local variant, or more than one in Shopify) — SKU/price can't be safely applied to a single variant yet.",
      };
    }
  }

  try {
    if (direction === "SHOPIFY_TO_SYNARAVA") {
      await writeLocally(productId, label, rawValue(difference.shopify), variant);
    } else {
      await writeToShopify(productId, label, rawValue(difference.local), variant);
    }
  } catch (error) {
    return { ok: false, reason: "WRITE_FAILED", message: error instanceof Error ? error.message : "This change could not be applied." };
  }

  await refreshProductSyncStatus(productId);

  return {
    ok: true,
    message: direction === "SHOPIFY_TO_SYNARAVA" ? "Shopify was applied to Synarava." : "Synarava was applied to Shopify.",
  };
}
