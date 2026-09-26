import "server-only";

import { db } from "@/lib/db";
import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";
import { shopifyAmountToCents } from "@/lib/shopify/money";

import { commerceFingerprint } from "./catalog-conflict";
import { adoptShopifyProjectionField, fetchShopifyProduct, inspectProductSyncState } from "./product-sync";
import { SCOPED_COMMERCE_FIELD_LABELS } from "./catalog-conflict-policy";

export { SCOPED_COMMERCE_FIELD_LABELS } from "./catalog-conflict-policy";

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

export type CommerceFieldApplyResult =
  | { ok: true; message: string }
  | { ok: false; reason: "STALE" | "UNSUPPORTED" | "WRITE_FAILED"; message: string };

/** `inspectProductSyncState`/`compare()` renders an empty value as "—"; this reverses that back to the real value to write. */
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

export type RefreshAfterWriteResult =
  | { status: "resolved" }
  | { status: "still-conflicting" }
  | { status: "unverifiable"; message: string };

/**
 * Re-inspects the product right after a successful field write to decide
 * whether the write can actually be reported as resolved, and — only when
 * it can — persists the product's true sync state.
 *
 * The write's own internal read-back check (in writeLocally/writeToShopify)
 * only confirms the mutation/update accepted and echoed the value we sent
 * — it does not confirm that the authoritative comparison this whole
 * system is built on (inspectProductSyncState/compare()) now agrees the
 * field is resolved. Those can disagree: something could change again
 * immediately after our write (a race with another process/webhook), or
 * the echoed value could satisfy our own equality check while compare()'s
 * normalization still sees a difference. Without this re-check,
 * applyCommerceField would report `ok: true` while the field is still
 * visibly conflicting — success shown to the admin, conflict still there.
 *
 * `state === "UNLINKED" | "REMOTE_MISSING"` is checked *first* and always
 * returns "unverifiable": inspectProductSyncState returns an unconditional
 * empty `differences` array for both — the comparison never even ran (no
 * Shopify link, or the remote product is gone) — so an empty list there
 * carries no information about whether the applied field is actually
 * resolved. Treating that empty list the same as "nothing left to
 * reconcile" (as a naive `differences.length === 0` check would) is
 * indistinguishable from a genuine resolution and would silently report
 * success for a write we have no evidence actually landed. `differences`
 * is only trustworthy as "nothing left to reconcile" once we know the
 * comparison actually ran.
 *
 * Once a real comparison ran (any other state), "resolved" is
 * `differences.length === 0` — deliberately not `inspection.state`, which
 * is derived partly from the *persisted* `syncStatus`/`shopifyUpdatedAt`
 * columns this function is responsible for fixing, and partly from a
 * timestamp check (`remote.updatedAt > local.shopifyUpdatedAt`) that
 * Shopify's own mutation just bumped. Right after this write resolves the
 * *only* remaining difference, both of those stale columns still read as
 * before — the persisted `syncStatus` is still "CONFLICT" and
 * `shopifyUpdatedAt` is still older than the just-mutated
 * `remote.updatedAt` — so `state` comes back "CONFLICT" even with an
 * empty `differences` list. Trusting `state` here would leave a
 * fully-resolved product stuck showing a conflict badge forever.
 */
async function refreshAfterWrite(productId: string, label: string): Promise<RefreshAfterWriteResult> {
  const inspection = await inspectProductSyncState(productId);

  if (inspection.state === "UNLINKED" || inspection.state === "REMOTE_MISSING") {
    return {
      status: "unverifiable",
      message: inspection.state === "REMOTE_MISSING"
        ? "The linked Shopify product no longer exists — this field's write could not be verified. Nothing is marked resolved."
        : "This product is no longer linked to Shopify — this field's write could not be verified. Nothing is marked resolved.",
    };
  }

  if (inspection.differences.some((item) => item.field === label)) {
    return { status: "still-conflicting" };
  }

  if (inspection.differences.length === 0) {
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

  return { status: "resolved" };
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
 * value — and then, independently, a fresh inspectProductSyncState
 * confirms the applied field itself no longer shows up as conflicting.
 * That second check is the one that counts: if it still does (a race with
 * another change, or a disagreement between the write's own echo check
 * and the authoritative comparison), this reports failure rather than a
 * false `ok: true` — an admin must never see success while the conflict
 * persists. The same fresh inspection also refreshes the product's
 * persisted sync state so a fully resolved product stops showing as
 * conflicted in the catalog list, while any other, still-differing field
 * keeps it visible.
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
      await adoptShopifyProjectionField(productId, difference.path);
    } else {
      await writeToShopify(productId, label, rawValue(difference.local), variant);
      // Accept Shopify's normalized echo into L and advance B for this path.
      await adoptShopifyProjectionField(productId, difference.path);
    }
  } catch (error) {
    return { ok: false, reason: "WRITE_FAILED", message: error instanceof Error ? error.message : "This change could not be applied." };
  }

  const refreshResult = await refreshAfterWrite(productId, label);
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
