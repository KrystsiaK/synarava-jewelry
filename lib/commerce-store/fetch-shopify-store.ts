import "server-only";

import { listShopifyProductWindowsForCommerceStore } from "@/lib/shopify/product-sync";
import {
  emptyCommerceStore,
  setProductWindow,
  type CommerceStore,
} from "@/lib/commerce-store/types";

/**
 * Build full SHOPIFY store snapshot (all products, commerce windows).
 * Uses paginated catalog query — not N× heavy single-product inspect.
 */
export async function fetchShopifyCommerceStore(
  onProgress?: (info: { page: number; fetched: number }) => void,
): Promise<CommerceStore> {
  const windows = await listShopifyProductWindowsForCommerceStore(onProgress);
  let store = emptyCommerceStore();
  for (const { id, window } of windows) {
    store = setProductWindow(store, id, window);
  }
  return store;
}
