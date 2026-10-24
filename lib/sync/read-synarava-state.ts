/**
 * Waterfall step 2 — read Synarava windows + latest reconcile / presence rows.
 * No network; no writes.
 */

import "server-only";

import { db } from "@/lib/db";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { getLatestCatalogPresenceDifferences } from "@/lib/shopify/catalog-presence-server";
import { getLatestCollectionPresenceDifferences } from "@/lib/shopify/collection-presence-server";
import { listUnseenIncomingProductUpdates } from "@/lib/shopify/catalog-conflict-review";
import {
  getLatestReconcileDifferences,
  getLatestReconcileRun,
} from "@/lib/shopify/reconciliation-run";

import type { SyncCommerceWindow, SyncCompareInput, SyncLocaleRef } from "./compare";
import type { RefreshShopifyStateScope } from "./refresh-shopify-state";

async function loadProductCommerceWindows(productId?: string): Promise<SyncCommerceWindow[]> {
  const products = await db.product.findMany({
    where: {
      shopifyProductId: { not: null },
      ...(productId ? { id: productId } : {}),
    },
    select: { id: true, workingSnapshot: true, shopifySnapshot: true },
  });
  return products.map((product) => ({
    resourceType: "PRODUCT" as const,
    resourceId: product.id,
    workingSnapshot: product.workingSnapshot,
    shopifySnapshot: product.shopifySnapshot,
  }));
}

async function loadCollectionCommerceWindows(collectionId?: string): Promise<SyncCommerceWindow[]> {
  // Windows exist on Collection (schema). Shopify copy refresh uses
  // refreshShopifyCollectionState (same owner model as products).
  const collections = await db.collection.findMany({
    where: {
      shopifyCollectionId: { not: null },
      ...(collectionId ? { id: collectionId } : {}),
    },
    select: { id: true, workingSnapshot: true, shopifySnapshot: true },
  });
  return collections.map((collection) => ({
    resourceType: "COLLECTION" as const,
    resourceId: collection.id,
    workingSnapshot: collection.workingSnapshot,
    shopifySnapshot: collection.shopifySnapshot,
  }));
}

export async function readSynaravaStateForCompare(
  scope: RefreshShopifyStateScope,
  options?: { adminUsername?: string; checkedAt?: string | null },
): Promise<SyncCompareInput> {
  const [differences, productPresence, collectionPresence, locales, run] = await Promise.all([
    getLatestReconcileDifferences(),
    getLatestCatalogPresenceDifferences(),
    getLatestCollectionPresenceDifferences(),
    getStorefrontLocales(),
    getLatestReconcileRun(),
  ]);

  let commerceWindows: SyncCommerceWindow[] = [];
  if (scope.kind === "product") {
    commerceWindows = await loadProductCommerceWindows(scope.productId);
  } else if (scope.kind === "collection") {
    commerceWindows = await loadCollectionCommerceWindows(scope.collectionId);
  } else if (scope.kind === "collections") {
    commerceWindows = await loadCollectionCommerceWindows();
  } else {
    commerceWindows = [
      ...(await loadProductCommerceWindows()),
      ...(await loadCollectionCommerceWindows()),
    ];
  }

  const recentlyUpdatedProducts = options?.adminUsername
    ? await listUnseenIncomingProductUpdates(options.adminUsername)
    : [];

  const localeRefs: SyncLocaleRef[] = locales.map((locale) => ({
    code: locale.code,
    shopifyLocale: locale.shopifyLocale,
    name: locale.name,
    nativeName: locale.nativeName,
    isDefault: locale.isDefault,
    sortOrder: locale.sortOrder,
  }));

  const includeProductPresence = scope.kind === "catalog" || scope.kind === "product";
  const includeCollectionPresence = scope.kind === "catalog"
    || scope.kind === "collection"
    || scope.kind === "collections";

  return {
    commerceWindows,
    translationDifferences: differences,
    productPresence: includeProductPresence ? productPresence : [],
    collectionPresence: includeCollectionPresence ? collectionPresence : [],
    locales: localeRefs,
    connected: hasShopifyAdminConfig(),
    checkedAt: options?.checkedAt
      ?? (run?.status === "SUCCEEDED" && (run.trigger === "AUTO" || run.trigger === "MANUAL")
        ? run.completedAt
        : null),
    runStatus: run?.status ?? null,
    runTrigger: run?.trigger ?? null,
    now: new Date(),
    recentlyUpdatedProducts,
  };
}
