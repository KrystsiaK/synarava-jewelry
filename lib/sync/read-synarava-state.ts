/**
 * Waterfall step 2 — read Synarava windows + latest reconcile / presence rows.
 * No network; no writes.
 *
 * OUR commerce window is derived from columns + extras (ADR-0009) — never stored.
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
import { hasWriteLocalesScope } from "@/lib/shopify/locale-mutations";
import { getShopifyShopLocalesSnapshot } from "@/lib/shopify/shop-locales-cache";
import {
  deriveFreeShippingThresholdWindow,
  readAnnouncementBarSetting,
} from "@/lib/content/announcement-bar";
import { FREE_SHIPPING_THRESHOLD_RESOURCE_ID } from "@/lib/content/announcement-bar-fields";
import {
  ourCollectionWindowFromRow,
  ourProductWindowFromRow,
} from "@/lib/sync/our-window-from-row";

import type { SyncCommerceWindow, SyncCompareInput, SyncLocaleRef } from "./compare";
import type { RefreshShopifyStateScope } from "./refresh-shopify-state";

async function loadShopCommerceWindows(): Promise<SyncCommerceWindow[]> {
  const setting = await readAnnouncementBarSetting();
  return [{
    resourceType: "SHOP",
    resourceId: FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
    ourWindow: deriveFreeShippingThresholdWindow(setting),
    shopifySnapshot: setting.shopifySnapshot,
  }];
}

async function loadProductCommerceWindows(productId?: string): Promise<SyncCommerceWindow[]> {
  const products = await db.product.findMany({
    where: {
      shopifyProductId: { not: null },
      ...(productId ? { id: productId } : {}),
    },
    select: {
      id: true,
      extras: true,
      shopifySnapshot: true,
      shopifyProductId: true,
      name: true,
      slug: true,
      description: true,
      vendor: true,
      productType: true,
      status: true,
      seoTitle: true,
      seoDescription: true,
      shopifyCategoryId: true,
      shopifyCategoryName: true,
      tags: {
        select: { tag: { select: { name: true } } },
      },
      collections: {
        select: {
          collection: {
            select: {
              shopifyCollectionId: true,
              slug: true,
              name: true,
            },
          },
        },
      },
      variants: {
        orderBy: { createdAt: "asc" },
        select: {
          shopifyVariantId: true,
          sku: true,
          title: true,
          barcode: true,
          priceCents: true,
          compareAtCents: true,
          inventoryPolicy: true,
          stockOnHand: true,
          taxable: true,
          selectedOptions: true,
          shopifyInventoryItemId: true,
          requiresShipping: true,
          tracked: true,
          costCents: true,
          weightGrams: true,
        },
      },
    },
  });
  return products.map((product) => ({
    resourceType: "PRODUCT" as const,
    resourceId: product.id,
    ourWindow: ourProductWindowFromRow(product),
    shopifySnapshot: product.shopifySnapshot,
  }));
}

async function loadCollectionCommerceWindows(collectionId?: string): Promise<SyncCommerceWindow[]> {
  const collections = await db.collection.findMany({
    where: {
      shopifyCollectionId: { not: null },
      ...(collectionId ? { id: collectionId } : {}),
    },
    select: {
      id: true,
      extras: true,
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
    ourWindow: ourCollectionWindowFromRow(collection),
    shopifySnapshot: collection.shopifySnapshot,
  }));
}

export async function readSynaravaStateForCompare(
  scope: RefreshShopifyStateScope,
  options?: { adminUsername?: string; checkedAt?: string | null },
): Promise<SyncCompareInput> {
  const connected = hasShopifyAdminConfig();
  const [differences, productPresence, collectionPresence, locales, run, shopLocalesSnapshot, canWriteShopifyLocales] =
    await Promise.all([
      getLatestReconcileDifferences(),
      getLatestCatalogPresenceDifferences(),
      getLatestCollectionPresenceDifferences(),
      getStorefrontLocales(),
      getLatestReconcileRun(),
      connected
        ? getShopifyShopLocalesSnapshot().catch(() => ({
          shopDomain: "unknown",
          locales: [],
          localeCodes: [] as string[],
        }))
        : Promise.resolve(null),
      connected
        ? hasWriteLocalesScope().catch(() => false)
        : Promise.resolve(false),
    ]);
  const enabledShopifyLocales = shopLocalesSnapshot?.localeCodes ?? null;
  const shopDomain = shopLocalesSnapshot?.shopDomain ?? null;

  let commerceWindows: SyncCommerceWindow[] = [];
  if (scope.kind === "product") {
    commerceWindows = await loadProductCommerceWindows(scope.productId);
  } else if (scope.kind === "collection") {
    commerceWindows = await loadCollectionCommerceWindows(scope.collectionId);
  } else if (scope.kind === "collections") {
    commerceWindows = await loadCollectionCommerceWindows();
  } else if (scope.kind === "shop") {
    commerceWindows = await loadShopCommerceWindows();
  } else {
    commerceWindows = [
      ...(await loadProductCommerceWindows()),
      ...(await loadCollectionCommerceWindows()),
      ...(await loadShopCommerceWindows()),
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
    enabledShopifyLocales,
    shopDomain,
    canWriteShopifyLocales,
    connected,
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
