import "server-only";

import { listShopifyCollectionWindowsForCommerceStore } from "@/lib/shopify/collection-commerce-fetch";
import { listShopifyProductWindowsForCommerceStore } from "@/lib/shopify/product-sync";
import {
  emptyCommerceStore,
  setCollectionWindow,
  setProductWindow,
  type CommerceStore,
} from "@/lib/commerce-store/types";

/**
 * Build full SHOPIFY store snapshot (products + collections, commerce windows).
 * Uses paginated catalog queries — not N× heavy single-entity inspect.
 */
export async function fetchShopifyCommerceStore(
  onProgress?: (info: { page: number; fetched: number; kind?: "product" | "collection" }) => void,
): Promise<CommerceStore> {
  const [productWindows, collectionWindows] = await Promise.all([
    listShopifyProductWindowsForCommerceStore((info) => onProgress?.({ ...info, kind: "product" })),
    listShopifyCollectionWindowsForCommerceStore((info) => onProgress?.({ ...info, kind: "collection" })),
  ]);
  let store = emptyCommerceStore();
  for (const { id, window } of productWindows) {
    store = setProductWindow(store, id, window);
  }
  for (const { id, window } of collectionWindows) {
    store = setCollectionWindow(store, id, window);
  }
  return store;
}
