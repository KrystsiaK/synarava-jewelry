import { diffShopifyProjections } from "@/lib/shopify/shopify-projection-diff";

import type { CommerceStore, CommerceStoreConflict } from "@/lib/commerce-store/types";

/**
 * Pure compare of two full stores.
 * Presence: only-in-our / only-in-shopify counted as conflicts with synthetic paths.
 */
export function compareCommerceStores(
  our: CommerceStore,
  shopify: CommerceStore,
): CommerceStoreConflict[] {
  const keys = new Set([...Object.keys(our.products), ...Object.keys(shopify.products)]);
  const conflicts: CommerceStoreConflict[] = [];

  for (const key of [...keys].toSorted()) {
    const left = our.products[key];
    const right = shopify.products[key];
    const shopifyProductId = key.startsWith("local:") ? null : key;
    const localProductId = key.startsWith("local:") ? key.slice("local:".length) : null;

    if (left == null && right != null) {
      conflicts.push({
        kind: "product",
        key,
        localProductId,
        shopifyProductId,
        differences: [{ path: "_presence", field: "Presence", local: "—", shopify: "Only in Shopify" }],
      });
      continue;
    }
    if (left != null && right == null) {
      conflicts.push({
        kind: "product",
        key,
        localProductId,
        shopifyProductId,
        differences: [{ path: "_presence", field: "Presence", local: "Only in Synarava", shopify: "—" }],
      });
      continue;
    }

    const differences = diffShopifyProjections(left, right).map((item) => ({
      path: item.path,
      field: item.field,
      local: item.local,
      shopify: item.shopify,
    }));
    if (differences.length === 0) continue;

    conflicts.push({
      kind: "product",
      key,
      localProductId,
      shopifyProductId,
      differences,
    });
  }

  return conflicts;
}
