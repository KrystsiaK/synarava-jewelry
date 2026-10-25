/**
 * Waterfall step 2 — read Synarava windows + latest reconcile / presence rows.
 * No network; no writes.
 *
 * Working snapshots: prefer persisted workingSnapshot; otherwise build from
 * Synarava columns so compare never invents "Adopt Shopify" for a real row.
 */

import "server-only";

import { db } from "@/lib/db";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { getLatestCatalogPresenceDifferences } from "@/lib/shopify/catalog-presence-server";
import { getLatestCollectionPresenceDifferences } from "@/lib/shopify/collection-presence-server";
import { listUnseenIncomingProductUpdates } from "@/lib/shopify/catalog-conflict-review";
import {
  resolveCollectionWorkingSnapshot,
  resolveProductWorkingSnapshot,
} from "@/lib/shopify/resolve-working-snapshot";
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
    select: {
      id: true,
      workingSnapshot: true,
      shopifySnapshot: true,
      name: true,
      slug: true,
      vendor: true,
      productType: true,
      priceCents: true,
      variants: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          shopifyVariantId: true,
          sku: true,
          priceCents: true,
          taxable: true,
          stockOnHand: true,
        },
      },
    },
  });
  return products.map((product) => {
    const variant = product.variants?.[0];
    return {
      resourceType: "PRODUCT" as const,
      resourceId: product.id,
      workingSnapshot: resolveProductWorkingSnapshot({
        workingSnapshot: product.workingSnapshot,
        shopifySnapshot: product.shopifySnapshot,
        name: product.name,
        slug: product.slug,
        vendor: product.vendor,
        productType: product.productType,
        priceCents: product.priceCents,
        variant: variant
          ? {
              shopifyVariantId: variant.shopifyVariantId,
              sku: variant.sku,
              priceCents: variant.priceCents,
              taxable: variant.taxable,
              inventoryQuantity: variant.stockOnHand,
            }
          : null,
      }),
      shopifySnapshot: product.shopifySnapshot,
    };
  });
}

async function loadCollectionCommerceWindows(collectionId?: string): Promise<SyncCommerceWindow[]> {
  const collections = await db.collection.findMany({
    where: {
      shopifyCollectionId: { not: null },
      ...(collectionId ? { id: collectionId } : {}),
    },
    select: {
      id: true,
      workingSnapshot: true,
      shopifySnapshot: true,
      shopifyCollectionId: true,
      name: true,
      slug: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
  return collections.map((collection) => ({
    resourceType: "COLLECTION" as const,
    resourceId: collection.id,
    workingSnapshot: resolveCollectionWorkingSnapshot({
      workingSnapshot: collection.workingSnapshot,
      shopifySnapshot: collection.shopifySnapshot,
      shopifyCollectionId: collection.shopifyCollectionId,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription,
    }),
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

  // checkedAt: fresh waterfall passes the stamp from that run; skipRefresh
  // falls back to the latest SUCCEEDED AUTO/MANUAL reconcile completedAt —
  // same source the top-bar Shopify signal uses (`AdminShopifySyncSignal`).
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
