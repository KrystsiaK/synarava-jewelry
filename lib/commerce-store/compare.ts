import { diffShopifyProjections } from "@/lib/shopify/shopify-projection-diff";

import type { CommerceStore, CommerceStoreConflict } from "@/lib/commerce-store/types";

function compareEntityMap(
  ourMap: Record<string, unknown>,
  shopifyMap: Record<string, unknown>,
  kind: "product" | "collection",
): CommerceStoreConflict[] {
  const keys = new Set([...Object.keys(ourMap), ...Object.keys(shopifyMap)]);
  const conflicts: CommerceStoreConflict[] = [];

  for (const key of [...keys].toSorted()) {
    const left = ourMap[key];
    const right = shopifyMap[key];
    const shopifyGid = key.startsWith("local:") ? null : key;
    const localId = key.startsWith("local:") ? key.slice("local:".length) : null;

    const ids = kind === "product"
      ? { localProductId: localId, shopifyProductId: shopifyGid, localCollectionId: null, shopifyCollectionId: null }
      : { localProductId: null, shopifyProductId: null, localCollectionId: localId, shopifyCollectionId: shopifyGid };

    if (left == null && right != null) {
      conflicts.push({
        kind,
        key,
        ...ids,
        differences: [{ path: "_presence", field: "Presence", local: "—", shopify: "Only in Shopify" }],
      });
      continue;
    }
    if (left != null && right == null) {
      conflicts.push({
        kind,
        key,
        ...ids,
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
      kind,
      key,
      ...ids,
      differences,
    });
  }

  return conflicts;
}

/**
 * Pure compare of two full stores.
 * Presence: only-in-our / only-in-shopify counted as conflicts with synthetic paths.
 */
export function compareCommerceStores(
  our: CommerceStore,
  shopify: CommerceStore,
): CommerceStoreConflict[] {
  return [
    ...compareEntityMap(our.products ?? {}, shopify.products ?? {}, "product"),
    ...compareEntityMap(our.collections ?? {}, shopify.collections ?? {}, "collection"),
  ];
}
