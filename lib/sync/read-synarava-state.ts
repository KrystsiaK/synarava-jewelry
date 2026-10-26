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
import {
  deriveCollectionWindow,
  deriveProductWindow,
  preferredHtmlFromShopifySnapshot,
} from "@/lib/sync/derive-window";

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
  return products.map((product) => {
    const name = product.name?.trim() ?? "";
    const slug = product.slug?.trim() ?? "";
    if (!name && !slug) {
      return {
        resourceType: "PRODUCT" as const,
        resourceId: product.id,
        ourWindow: null,
        shopifySnapshot: product.shopifySnapshot,
      };
    }
    return {
      resourceType: "PRODUCT" as const,
      resourceId: product.id,
      ourWindow: deriveProductWindow({
        shopifyProductId: product.shopifyProductId,
        name,
        slug,
        description: product.description,
        vendor: product.vendor,
        productType: product.productType,
        status: product.status,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        shopifyCategoryId: product.shopifyCategoryId,
        shopifyCategoryName: product.shopifyCategoryName,
        tags: product.tags.map((row) => row.tag.name),
        collections: product.collections.flatMap((row) => {
          const id = row.collection.shopifyCollectionId;
          if (!id) return [];
          return [{
            id,
            handle: row.collection.slug,
            title: row.collection.name,
          }];
        }),
        variants: product.variants.map((variant) => ({
          shopifyVariantId: variant.shopifyVariantId,
          sku: variant.sku,
          title: variant.title,
          barcode: variant.barcode,
          priceCents: variant.priceCents,
          compareAtCents: variant.compareAtCents,
          inventoryPolicy: variant.inventoryPolicy,
          stockOnHand: variant.stockOnHand,
          taxable: variant.taxable,
          selectedOptions: variant.selectedOptions,
          shopifyInventoryItemId: variant.shopifyInventoryItemId,
          requiresShipping: variant.requiresShipping,
          tracked: variant.tracked,
          costCents: variant.costCents,
          weightGrams: variant.weightGrams == null ? null : Number(variant.weightGrams),
        })),
        extras: product.extras,
        preferredDescriptionHtml: preferredHtmlFromShopifySnapshot(
          product.shopifySnapshot,
          "descriptionHtml",
        ),
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
  return collections.map((collection) => {
    const name = collection.name?.trim() ?? "";
    const slug = collection.slug?.trim() ?? "";
    if (!name && !slug) {
      return {
        resourceType: "COLLECTION" as const,
        resourceId: collection.id,
        ourWindow: null,
        shopifySnapshot: collection.shopifySnapshot,
      };
    }
    return {
      resourceType: "COLLECTION" as const,
      resourceId: collection.id,
      ourWindow: deriveCollectionWindow({
        shopifyCollectionId: collection.shopifyCollectionId,
        name,
        slug,
        description: collection.description,
        seoTitle: collection.seoTitle,
        seoDescription: collection.seoDescription,
        extras: collection.extras,
        preferredDescriptionHtml: preferredHtmlFromShopifySnapshot(
          collection.shopifySnapshot,
          "descriptionHtml",
        ),
      }),
      shopifySnapshot: collection.shopifySnapshot,
    };
  });
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
