import "server-only";

import type { Prisma } from "@prisma/client";

import { compareCommerceStores } from "@/lib/commerce-store/compare";
import { buildOurCommerceStore } from "@/lib/commerce-store/build-our-store";
import { fetchShopifyCommerceStore } from "@/lib/commerce-store/fetch-shopify-store";
import {
  coerceCommerceStore,
  collectionStoreKey,
  productStoreKey,
  setCollectionWindow,
  setProductWindow,
  type CommerceStore,
  type CommerceStoreRefreshResult,
} from "@/lib/commerce-store/types";
import { db } from "@/lib/db";

export const COMMERCE_SYNC_STORE_ID = "default";

/**
 * Full dual-store refresh:
 * 1) our  ← entire DB commerce windows
 * 2) shopify ← entire Shopify catalog windows
 * 3) persist both
 * 4) compare → all conflicts
 */
export async function refreshCommerceSyncStore(): Promise<CommerceStoreRefreshResult> {
  const our = await buildOurCommerceStore();
  const shopify = await fetchShopifyCommerceStore();
  return persistComparedCommerceStores(our, shopify);
}

export async function persistComparedCommerceStores(
  our: CommerceStore,
  shopify: CommerceStore,
): Promise<CommerceStoreRefreshResult> {
  const conflicts = compareCommerceStores(our, shopify);

  await db.commerceSyncStore.upsert({
    where: { id: COMMERCE_SYNC_STORE_ID },
    create: {
      id: COMMERCE_SYNC_STORE_ID,
      ourSnapshot: our as unknown as Prisma.InputJsonValue,
      shopifySnapshot: shopify as unknown as Prisma.InputJsonValue,
      conflictReport: conflicts as unknown as Prisma.InputJsonValue,
    },
    update: {
      ourSnapshot: our as unknown as Prisma.InputJsonValue,
      shopifySnapshot: shopify as unknown as Prisma.InputJsonValue,
      conflictReport: conflicts as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    our,
    shopify,
    conflicts,
    debug: {
      ourProductCount: Object.keys(our.products).length,
      shopifyProductCount: Object.keys(shopify.products).length,
      ourCollectionCount: Object.keys(our.collections).length,
      shopifyCollectionCount: Object.keys(shopify.collections).length,
      conflictCount: conflicts.length,
    },
  };
}

export async function readCommerceSyncStore() {
  return db.commerceSyncStore.findUnique({ where: { id: COMMERCE_SYNC_STORE_ID } });
}

/**
 * Point-update OUR product slice after a local commerce edit (Redux-style).
 * Re-compares against persisted shopify snapshot; does not refetch Shopify.
 */
export async function patchOurProductWindow(input: {
  shopifyProductId?: string | null;
  localProductId: string;
  window: unknown;
}): Promise<void> {
  const row = await db.commerceSyncStore.findUnique({ where: { id: COMMERCE_SYNC_STORE_ID } });
  if (!row) return;

  const our = coerceCommerceStore(row.ourSnapshot);
  const shopify = coerceCommerceStore(row.shopifySnapshot);
  const key = productStoreKey({
    shopifyProductId: input.shopifyProductId,
    localProductId: input.localProductId,
  });
  const nextOur = setProductWindow(our, key, input.window);
  const conflicts = compareCommerceStores(nextOur, shopify);

  await db.commerceSyncStore.update({
    where: { id: COMMERCE_SYNC_STORE_ID },
    data: {
      ourSnapshot: nextOur as unknown as Prisma.InputJsonValue,
      conflictReport: conflicts as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Point-update OUR collection slice after a local commerce edit.
 */
export async function patchOurCollectionWindow(input: {
  shopifyCollectionId?: string | null;
  localCollectionId: string;
  window: unknown;
}): Promise<void> {
  const row = await db.commerceSyncStore.findUnique({ where: { id: COMMERCE_SYNC_STORE_ID } });
  if (!row) return;

  const our = coerceCommerceStore(row.ourSnapshot);
  const shopify = coerceCommerceStore(row.shopifySnapshot);
  const key = collectionStoreKey({
    shopifyCollectionId: input.shopifyCollectionId,
    localCollectionId: input.localCollectionId,
  });
  const nextOur = setCollectionWindow(our, key, input.window);
  const conflicts = compareCommerceStores(nextOur, shopify);

  await db.commerceSyncStore.update({
    where: { id: COMMERCE_SYNC_STORE_ID },
    data: {
      ourSnapshot: nextOur as unknown as Prisma.InputJsonValue,
      conflictReport: conflicts as unknown as Prisma.InputJsonValue,
    },
  });
}
