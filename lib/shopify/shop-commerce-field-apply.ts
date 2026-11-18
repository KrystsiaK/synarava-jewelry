/**
 * Scoped Apply for SHOP commerce leaves (free-shipping threshold).
 * Take Shopify only — never push the Portugal delivery-profile amount.
 */

import "server-only";

import { adoptFreeShippingThresholdFromShopify } from "@/lib/content/announcement-bar";
import { FREE_SHIPPING_THRESHOLD_RESOURCE_ID } from "@/lib/content/announcement-bar-fields";
import {
  findConflictLeaf,
  gateWriteConvergence,
  intendedAddressFromLeaf,
  leafMatchesExpectedFingerprints,
  recheckEntityConflictLeaves,
} from "@/lib/sync";
import { isScopedShopCommerceFieldLabel } from "@/lib/shopify/catalog-conflict-policy";

export type ShopCommerceFieldApplyResult =
  | { ok: true; message: string }
  | { ok: false; reason: "STALE" | "UNSUPPORTED" | "WRITE_FAILED"; message: string };

/**
 * Apply one shop commerce field. Re-validates fingerprints, then copies the
 * Shopify observation into OUR working `threshold` (human Apply only).
 */
export async function applyShopCommerceField({
  shopId,
  label,
  fieldKey,
  direction,
  expectedLocalFingerprint,
  expectedShopifyFingerprint,
  requestedBy = "system",
}: {
  shopId: string;
  label: string;
  fieldKey?: string;
  direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
  requestedBy?: string;
}): Promise<ShopCommerceFieldApplyResult> {
  if (shopId !== FREE_SHIPPING_THRESHOLD_RESOURCE_ID) {
    return { ok: false, reason: "UNSUPPORTED", message: "Unknown shop commerce resource." };
  }
  if (!isScopedShopCommerceFieldLabel(label)) {
    return { ok: false, reason: "UNSUPPORTED", message: `${label} is not a supported shop commerce field.` };
  }
  if (direction !== "SHOPIFY_TO_SYNARAVA") {
    return {
      ok: false,
      reason: "UNSUPPORTED",
      message: "Free shipping threshold is Shopify-owned — Keep ours / push is not supported.",
    };
  }

  let leaves;
  try {
    ({ leaves } = await recheckEntityConflictLeaves({
      resourceType: "SHOP",
      resourceId: shopId,
      requestedBy,
    }));
  } catch (error) {
    return {
      ok: false,
      reason: "WRITE_FAILED",
      message: error instanceof Error ? error.message : "Could not recheck shop commerce state.",
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
    await adoptFreeShippingThresholdFromShopify();
  } catch (error) {
    return {
      ok: false,
      reason: "WRITE_FAILED",
      message: error instanceof Error ? error.message : "Could not adopt the Shopify free-shipping threshold.",
    };
  }

  // Money deepDiff may emit amount + currencyCode siblings — clear the whole contract.
  const intended = leaves
    .filter((candidate) => candidate.contractKey === leaf.contractKey)
    .map(intendedAddressFromLeaf);
  const gate = await gateWriteConvergence({
    resourceType: "SHOP",
    resourceId: shopId,
    requestedBy,
    leavesBefore: leaves,
    intended: intended.length > 0 ? intended : [intendedAddressFromLeaf(leaf)],
  });
  if (!gate.ok) {
    return { ok: false, reason: "WRITE_FAILED", message: gate.message };
  }

  return { ok: true, message: "Shopify free-shipping threshold applied to Synarava." };
}
