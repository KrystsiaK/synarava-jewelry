/**
 * Redux-style commerce sync store.
 * Two full snapshots side by side; point updates to slices; compare derives conflicts.
 */

export const COMMERCE_STORE_VERSION = 1 as const;

export type CommerceEntityKind = "product" | "collection";

/** One commerce window — Shopify-shaped JSON (same for our + shopify sides). */
export type CommerceWindow = unknown;

export type CommerceStore = {
  version: typeof COMMERCE_STORE_VERSION;
  /** Key: shopify GID when linked, else `local:<productId>`. */
  products: Record<string, CommerceWindow>;
  /** Key: shopify GID when linked, else `local:<collectionId>`. */
  collections: Record<string, CommerceWindow>;
};

export type CommerceStorePair = {
  our: CommerceStore;
  shopify: CommerceStore;
};

export type CommerceStoreConflict = {
  kind: CommerceEntityKind;
  key: string;
  localProductId: string | null;
  shopifyProductId: string | null;
  localCollectionId?: string | null;
  shopifyCollectionId?: string | null;
  differences: Array<{ path: string; field: string; local: string; shopify: string }>;
};

export type CommerceStoreRefreshResult = {
  our: CommerceStore;
  shopify: CommerceStore;
  conflicts: CommerceStoreConflict[];
  debug: {
    ourProductCount: number;
    shopifyProductCount: number;
    ourCollectionCount: number;
    shopifyCollectionCount: number;
    conflictCount: number;
  };
};

export function emptyCommerceStore(): CommerceStore {
  return { version: COMMERCE_STORE_VERSION, products: {}, collections: {} };
}

/** Coerce persisted JSON that may predate the collections map. */
export function coerceCommerceStore(raw: unknown): CommerceStore {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyCommerceStore();
  const record = raw as Partial<CommerceStore>;
  return {
    version: COMMERCE_STORE_VERSION,
    products: record.products && typeof record.products === "object" && !Array.isArray(record.products)
      ? record.products
      : {},
    collections: record.collections && typeof record.collections === "object" && !Array.isArray(record.collections)
      ? record.collections
      : {},
  };
}

/** Immutable slice write (Redux-style). */
export function setProductWindow(
  store: CommerceStore,
  key: string,
  window: CommerceWindow,
): CommerceStore {
  return {
    ...store,
    products: { ...store.products, [key]: window },
  };
}

export function setCollectionWindow(
  store: CommerceStore,
  key: string,
  window: CommerceWindow,
): CommerceStore {
  return {
    ...store,
    collections: { ...store.collections, [key]: window },
  };
}

export function productStoreKey(input: {
  shopifyProductId?: string | null;
  localProductId: string;
}): string {
  return input.shopifyProductId?.trim() || `local:${input.localProductId}`;
}

export function collectionStoreKey(input: {
  shopifyCollectionId?: string | null;
  localCollectionId: string;
}): string {
  return input.shopifyCollectionId?.trim() || `local:${input.localCollectionId}`;
}
