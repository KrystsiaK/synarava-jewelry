import "server-only";

import { db } from "@/lib/db";
import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";

type UserError = { field?: string[] | null; message: string };

/**
 * Commerce fields safe to apply individually right now: plain scalars on
 * the product or its single/primary variant, with a Shopify mutation that
 * accepts a partial input (only the changed key), so nothing else on the
 * product is read back or rewritten. Their inspectProductSyncState label
 * carries a " (SKU)" suffix once a product has more than one variant (see
 * product-sync.ts's variantSuffix) — that suffixed label never matches this
 * set, so multi-variant products fall through to UNSUPPORTED automatically
 * rather than this code guessing which variant the caller meant.
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

/** `inspectProductSyncState`/`compare()` renders an empty value as "—"; this reverses that back to the real value to write. */
function rawValue(displayValue: string): string {
  return displayValue === "—" ? "" : displayValue;
}

function throwOnUserErrors(errors: UserError[]) {
  if (errors.length > 0) throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
}

async function primaryVariant(productId: string) {
  return db.productVariant.findFirst({ where: { productId }, orderBy: { createdAt: "asc" } });
}

async function writeLocally(productId: string, label: string, value: string) {
  if (label === "Vendor") {
    await db.product.update({ where: { id: productId }, data: { vendor: value || null } });
    return;
  }
  if (label === "Product type") {
    await db.product.update({ where: { id: productId }, data: { productType: value || null } });
    return;
  }
  const variant = await primaryVariant(productId);
  if (!variant) throw new Error("This product has no variant to update.");
  if (label === "Variant SKU") {
    await db.productVariant.update({ where: { id: variant.id }, data: { sku: value } });
    return;
  }
  if (label === "Price") {
    await db.productVariant.update({ where: { id: variant.id }, data: { priceCents: Number(value) } });
    return;
  }
  if (label === "Compare-at price") {
    await db.productVariant.update({ where: { id: variant.id }, data: { compareAtCents: value ? Number(value) : null } });
    return;
  }
  throw new Error(`${label} is not a supported commerce field.`);
}

async function writeToShopify(productId: string, label: string, value: string) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { shopifyProductId: true } });
  if (!product?.shopifyProductId) throw new Error("This product is not linked to Shopify.");

  if (label === "Vendor" || label === "Product type") {
    const key = label === "Vendor" ? "vendor" : "productType";
    const result = await shopifyAdminRequest<{
      productUpdate: { product: { id: string } | null; userErrors: UserError[] };
    }>(
      `mutation SynaravaCommerceFieldUpdate($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product { id }
          userErrors { field message }
        }
      }`,
      { product: { id: product.shopifyProductId, [key]: value } },
    );
    throwOnUserErrors(result.productUpdate.userErrors);
    if (!result.productUpdate.product) throw new ShopifyAdminError("Shopify did not return the updated product.");
    return;
  }

  if (label === "Variant SKU" || label === "Price" || label === "Compare-at price") {
    const variant = await primaryVariant(productId);
    if (!variant?.shopifyVariantId) throw new Error("This product's variant is not linked to Shopify.");
    const input: Record<string, unknown> = { id: variant.shopifyVariantId };
    if (label === "Price") input.price = (Number(value) / 100).toFixed(2);
    else if (label === "Compare-at price") input.compareAtPrice = value ? (Number(value) / 100).toFixed(2) : null;
    else input.inventoryItem = { sku: value };

    const result = await shopifyAdminRequest<{
      productVariantsBulkUpdate: { productVariants: Array<{ id: string }>; userErrors: UserError[] };
    }>(
      `mutation SynaravaCommerceVariantUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id }
          userErrors { field message }
        }
      }`,
      { productId: product.shopifyProductId, variants: [input] },
    );
    throwOnUserErrors(result.productVariantsBulkUpdate.userErrors);
    if (!result.productVariantsBulkUpdate.productVariants[0]) throw new ShopifyAdminError("Shopify did not return the updated variant.");
    return;
  }

  throw new Error(`${label} is not a supported commerce field.`);
}

/**
 * Applies one already-validated commerce field in one direction. The
 * caller is responsible for re-checking the field is still current
 * (fingerprint match) immediately before calling this — this function only
 * performs the write, it does not re-validate staleness itself. Unlike
 * applyReconcileChoice's translation path, this does not re-fetch and
 * compare the written value afterward; it trusts the mutation's own
 * userErrors/returned id. That is a slightly lower verification bar than
 * translation apply, accepted for this first narrow slice — add a
 * read-after-write check here if commerce apply needs the same guarantee.
 */
export async function applyCommerceField({
  productId,
  label,
  direction,
  shopifyValue,
  synaravaValue,
}: {
  productId: string;
  label: string;
  direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
  shopifyValue: string;
  synaravaValue: string;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!SCOPED_COMMERCE_FIELD_LABELS.has(label)) {
    return { ok: false, message: `${label} is not a supported commerce field.` };
  }
  try {
    if (direction === "SHOPIFY_TO_SYNARAVA") {
      await writeLocally(productId, label, rawValue(shopifyValue));
      return { ok: true, message: "Shopify was applied to Synarava." };
    }
    await writeToShopify(productId, label, rawValue(synaravaValue));
    return { ok: true, message: "Synarava was applied to Shopify." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "This change could not be applied." };
  }
}
