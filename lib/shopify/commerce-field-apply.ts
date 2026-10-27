import "server-only";

import { db } from "@/lib/db";
import {
  findConflictLeaf,
  leafMatchesExpectedFingerprints,
  recheckEntityConflictLeaves,
  type SyncLeaf,
} from "@/lib/sync";
import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";
import { shopifyAmountToCents } from "@/lib/shopify/money";

import {
  adoptShopifyProjectionField,
  fetchShopifyProduct,
  pushProductToShopify,
} from "./product-sync";
import {
  isMediaGalleryFieldLabel,
  isScopedCommerceFieldLabel,
} from "./catalog-conflict-policy";

export { SCOPED_COMMERCE_FIELD_LABELS, isMediaGalleryFieldLabel, isScopedCommerceFieldLabel } from "./catalog-conflict-policy";

type UserError = { field?: string[] | null; message: string };

/**
 * Commerce fields safe to apply individually right now: plain scalars on
 * the product or its single variant, with a Shopify mutation that accepts
 * a partial input (only the changed key), so nothing else on the product
 * is read back or rewritten. Multi-variant labels from projection diff
 * (`Price (variant 2)`) never match this set.
 *
 * Left out of this first slice: Status (Product.status has a fourth,
 * Synarava-only "UNLISTED" value with no Shopify equivalent — it's coupled
 * to the online-store publication toggle, not a plain scalar), Synarava
 * storefront visibility (derived from status + publication), Product
 * category (taxonomy id, its own input shape), Tags/Collections/Media/
 * Characteristics (array-shaped, need real merge semantics). Each needs its
 * own design, not a slot in this set.
 */
const VARIANT_FIELD_LABELS = new Set(["Variant SKU", "Price", "Compare-at price", "Charge tax"]);
const PRODUCT_SCALAR_LABELS = new Set(["Name", "Handle", "Vendor", "Product type"]);

export type CommerceFieldApplyResult =
  | { ok: true; message: string }
  | { ok: false; reason: "STALE" | "UNSUPPORTED" | "WRITE_FAILED"; message: string };

/** SyncResult leaves render an empty value as "—"; reverse that for writes. */
function rawValue(displayValue: string): string {
  return displayValue === "—" ? "" : displayValue;
}

/** Projection stores Shopify money strings; older inspections used integer cents. */
function moneyToCents(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.includes(".")) return shopifyAmountToCents(trimmed);
  return Number(trimmed);
}

function moneyToShopifyAmount(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "0.00";
  if (trimmed.includes(".")) return Number(trimmed).toFixed(2);
  return (Number(trimmed) / 100).toFixed(2);
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
  if (label === "Name") {
    const updated = await db.product.update({ where: { id: productId }, data: { name: value } });
    if (updated.name !== value) throw new Error("Local write did not take effect as expected.");
    return;
  }
  if (label === "Handle") {
    const handle = value.trim();
    if (!handle) throw new Error("Handle cannot be empty.");
    const clash = await db.product.findFirst({
      where: { slug: handle, NOT: { id: productId } },
      select: { id: true },
    });
    if (clash) throw new Error(`Handle "${handle}" is already used by another Synarava product.`);
    const updated = await db.product.update({
      where: { id: productId },
      data: { slug: handle, shopifyHandle: handle },
    });
    if (updated.slug !== handle) throw new Error("Local write did not take effect as expected.");
    return;
  }
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
    const cents = moneyToCents(value);
    const updated = await db.productVariant.update({ where: { id: variant.localVariantId }, data: { priceCents: cents } });
    if (updated.priceCents !== cents) throw new Error("Local write did not take effect as expected.");
    await db.product.update({ where: { id: productId }, data: { priceCents: cents } });
    return;
  }
  if (label === "Compare-at price") {
    const nextValue = value.trim() ? moneyToCents(value) : null;
    const updated = await db.productVariant.update({ where: { id: variant.localVariantId }, data: { compareAtCents: nextValue } });
    if (updated.compareAtCents !== nextValue) throw new Error("Local write did not take effect as expected.");
    await db.product.update({ where: { id: productId }, data: { compareAtCents: nextValue } });
    return;
  }
  if (label === "Charge tax") {
    const nextValue = value === "Yes" || value === "true";
    const updated = await db.productVariant.update({ where: { id: variant.localVariantId }, data: { taxable: nextValue } });
    if (updated.taxable !== nextValue) throw new Error("Local write did not take effect as expected.");
    return;
  }
  throw new Error(`${label} is not a supported commerce field.`);
}

async function writeToShopify(productId: string, label: string, value: string, variant: VariantPair | null) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { shopifyProductId: true } });
  if (!product?.shopifyProductId) throw new Error("This product is not linked to Shopify.");

  if (PRODUCT_SCALAR_LABELS.has(label)) {
    const input: Record<string, unknown> = { id: product.shopifyProductId };
    if (label === "Name") input.title = value;
    else if (label === "Handle") {
      const handle = value.trim();
      if (!handle) throw new Error("Handle cannot be empty.");
      input.handle = handle;
    } else if (label === "Vendor") input.vendor = value;
    else input.productType = value;

    const result = await shopifyAdminRequest<{
      productUpdate: {
        product: {
          id: string;
          title: string;
          handle: string;
          vendor: string | null;
          productType: string | null;
        } | null;
        userErrors: UserError[];
      };
    }>(
      `mutation SynaravaCommerceFieldUpdate($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product { id title handle vendor productType }
          userErrors { field message }
        }
      }`,
      { product: input },
    );
    throwOnUserErrors(result.productUpdate.userErrors);
    const saved = result.productUpdate.product;
    if (!saved) throw new ShopifyAdminError("Shopify did not return the updated product.");
    const savedValue = label === "Name" ? saved.title
      : label === "Handle" ? saved.handle
        : label === "Vendor" ? (saved.vendor ?? "")
          : (saved.productType ?? "");
    const expected = label === "Handle" ? value.trim() : value;
    if (savedValue !== expected) {
      throw new ShopifyAdminError("Shopify accepted the request but the read-back value did not match. Nothing is marked resolved.");
    }
    return;
  }

  if (label === "Variant SKU" || label === "Price" || label === "Compare-at price" || label === "Charge tax") {
    if (!variant) throw new Error("This product's variant could not be determined.");
    const input: Record<string, unknown> = { id: variant.shopifyVariantId };
    if (label === "Price") input.price = moneyToShopifyAmount(value);
    else if (label === "Compare-at price") input.compareAtPrice = value.trim() ? moneyToShopifyAmount(value) : null;
    else if (label === "Charge tax") input.taxable = value === "Yes" || value === "true";
    else input.inventoryItem = { sku: value };

    const result = await shopifyAdminRequest<{
      productVariantsBulkUpdate: {
        productVariants: Array<{
          id: string;
          price: string;
          compareAtPrice: string | null;
          taxable: boolean;
          inventoryItem: { sku: string | null };
        }>;
        userErrors: UserError[];
      };
    }>(
      `mutation SynaravaCommerceVariantUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id price compareAtPrice taxable inventoryItem { sku } }
          userErrors { field message }
        }
      }`,
      { productId: product.shopifyProductId, variants: [input] },
    );
    throwOnUserErrors(result.productVariantsBulkUpdate.userErrors);
    const saved = result.productVariantsBulkUpdate.productVariants[0];
    if (!saved) throw new ShopifyAdminError("Shopify did not return the updated variant.");
    const expectedPrice = moneyToShopifyAmount(value);
    const expectedCompareAt = value.trim() ? moneyToShopifyAmount(value) : "";
    const readBackMatches = label === "Variant SKU" ? (saved.inventoryItem.sku ?? "") === value
      : label === "Price" ? saved.price === expectedPrice
        : label === "Charge tax" ? saved.taxable === (value === "Yes" || value === "true")
          : (saved.compareAtPrice ?? "") === expectedCompareAt;
    if (!readBackMatches) throw new ShopifyAdminError("Shopify accepted the request but the read-back value did not match. Nothing is marked resolved.");
    return;
  }

  throw new Error(`${label} is not a supported commerce field.`);
}

function leafStillOpen(
  leaves: readonly SyncLeaf[],
  label: string,
): boolean {
  if (isMediaGalleryFieldLabel(label)) {
    return leaves.some((leaf) => isMediaGalleryFieldLabel(leaf.label));
  }
  return findConflictLeaf(leaves, { label }) != null;
}

/**
 * Re-check SyncResult leaves after a successful field write.
 * Field leaf gone = resolved. Does **not** write `syncStatus: SYNCED`
 * (conflict inventory is SyncResult leaves, not that column).
 */
async function verifyAfterWrite(
  productId: string,
  label: string,
  requestedBy: string,
): Promise<
  | { status: "resolved" }
  | { status: "still-conflicting" }
  | { status: "unverifiable"; message: string }
> {
  try {
    const { leaves } = await recheckEntityConflictLeaves({
      resourceType: "PRODUCT",
      resourceId: productId,
      requestedBy,
    });
    if (leafStillOpen(leaves, label)) {
      return { status: "still-conflicting" };
    }
    return { status: "resolved" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Post-write recheck failed.";
    if (/was not found|no longer exists|not linked/i.test(message)) {
      return {
        status: "unverifiable",
        message: /was not found|no longer exists/i.test(message)
          ? "The linked Shopify product no longer exists — this field's write could not be verified. Nothing is marked resolved."
          : "This product is no longer linked to Shopify — this field's write could not be verified. Nothing is marked resolved.",
      };
    }
    return { status: "unverifiable", message };
  }
}

/**
 * Applies one commerce field in one direction — re-validated against fresh
 * SyncResult leaves (refresh + compareSyncState) immediately before writing.
 * After a successful write, the same leaf compare confirms the field is gone.
 * Does not treat `syncStatus` as conflict inventory.
 */
export async function applyCommerceField({
  productId,
  label,
  fieldKey,
  direction,
  expectedLocalFingerprint,
  expectedShopifyFingerprint,
  requestedBy = "system",
}: {
  productId: string;
  label: string;
  fieldKey?: string;
  direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
  requestedBy?: string;
}): Promise<CommerceFieldApplyResult> {
  if (!isScopedCommerceFieldLabel(label)) {
    return { ok: false, reason: "UNSUPPORTED", message: `${label} is not a supported commerce field.` };
  }

  let leaves;
  try {
    ({ leaves } = await recheckEntityConflictLeaves({
      resourceType: "PRODUCT",
      resourceId: productId,
      requestedBy,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not recheck this product.";
    return {
      ok: false,
      reason: "WRITE_FAILED",
      message: /was not found|no longer exists/i.test(message)
        ? "The linked Shopify product no longer exists — this field's write could not be verified. Nothing is marked resolved."
        : message,
    };
  }

  const leaf = findConflictLeaf(leaves, { fieldKey, label });
  if (!leaf) {
    return { ok: false, reason: "STALE", message: "This field is no longer different — it may already have been resolved." };
  }
  if (!leafMatchesExpectedFingerprints(leaf, {
    localFingerprint: expectedLocalFingerprint,
    shopifyFingerprint: expectedShopifyFingerprint,
  })) {
    return { ok: false, reason: "STALE", message: "Synarava or Shopify changed since this was reviewed. Refresh and try again." };
  }

  try {
    if (isMediaGalleryFieldLabel(label)) {
      if (direction === "SHOPIFY_TO_SYNARAVA") {
        await adoptShopifyProjectionField(productId, "media");
      } else {
        const pushed = await pushProductToShopify(productId, {
          authorizeCommerceConflictOverwrite: true,
          pushRegisteredTranslations: true,
        });
        if (!pushed.ok) {
          return { ok: false, reason: "WRITE_FAILED", message: pushed.error ?? "Media could not be pushed to Shopify." };
        }
        await adoptShopifyProjectionField(productId, "media");
      }
    } else {
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

      if (direction === "SHOPIFY_TO_SYNARAVA") {
        await writeLocally(productId, label, rawValue(leaf.shopifyValue), variant);
        await adoptShopifyProjectionField(productId, leaf.path ?? undefined);
      } else {
        await writeToShopify(productId, label, rawValue(leaf.synaravaValue), variant);
        await adoptShopifyProjectionField(productId, leaf.path ?? undefined);
      }
    }
  } catch (error) {
    return { ok: false, reason: "WRITE_FAILED", message: error instanceof Error ? error.message : "This change could not be applied." };
  }

  const refreshResult = await verifyAfterWrite(productId, label, requestedBy);
  if (refreshResult.status === "unverifiable") {
    return { ok: false, reason: "WRITE_FAILED", message: refreshResult.message };
  }
  if (refreshResult.status === "still-conflicting") {
    return {
      ok: false,
      reason: "WRITE_FAILED",
      message: "The write went through, but Shopify and Synarava still disagree on this field after re-checking. Nothing is marked resolved — try again.",
    };
  }

  return {
    ok: true,
    message: direction === "SHOPIFY_TO_SYNARAVA" ? "Shopify was applied to Synarava." : "Synarava was applied to Shopify.",
  };
}
