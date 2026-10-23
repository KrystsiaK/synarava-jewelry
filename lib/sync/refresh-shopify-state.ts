/**
 * Waterfall step 1 — fetch + persist Shopify copy only.
 * Never writes Synarava columns / workingSnapshot / translations.
 */

import "server-only";

import { refreshShopifyProductState } from "@/lib/shopify/product-sync";
import {
  getLatestCatalogPresenceDifferences,
  scanAndSaveCatalogPresence,
} from "@/lib/shopify/catalog-presence-server";
import {
  getLatestCollectionPresenceDifferences,
  scanAndSaveCollectionPresence,
} from "@/lib/shopify/collection-presence-server";
import { runTranslationReconciliation } from "@/lib/shopify/reconciliation-run";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { db } from "@/lib/db";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";

async function resolveShopifyLocale(registryCode: string): Promise<string | null> {
  if (registryCode === "en") return "en";
  const locales = await getPublishedStorefrontLocales();
  return locales.find((locale) => !locale.isDefault && locale.code === registryCode)?.shopifyLocale ?? null;
}

export type RefreshShopifyStateScope =
  | { kind: "catalog" }
  | { kind: "product"; productId: string; locale?: string }
  | { kind: "collection"; collectionId: string; locale?: string }
  | { kind: "collections" };

export type RefreshShopifyStateResult = {
  ok: boolean;
  warning?: string;
  runId: string | null;
};

/**
 * Refresh Shopify-side state for the given scope.
 * Collection commerce refresh lands with sync-unification PR4
 * (`refreshShopifyCollectionState`); until then collections refresh
 * translations + presence only.
 */
export async function refreshShopifyState(
  scope: RefreshShopifyStateScope,
  requestedBy: string,
): Promise<RefreshShopifyStateResult> {
  if (!hasShopifyAdminConfig()) {
    return { ok: false, warning: "Shopify Admin API credentials are not configured.", runId: null };
  }

  const warnings: string[] = [];

  if (scope.kind === "product") {
    const product = await db.product.findUnique({
      where: { id: scope.productId },
      select: { shopifyProductId: true },
    });
    if (product?.shopifyProductId) {
      await refreshShopifyProductState(product.shopifyProductId);
    }
    const shopifyLocale = scope.locale ? await resolveShopifyLocale(scope.locale) : null;
    if (scope.locale && !shopifyLocale) {
      return {
        ok: true,
        warning: `Locale ${scope.locale} is not published in Shopify Markets.`,
        runId: null,
      };
    }
    const translationRun = await runTranslationReconciliation({
      trigger: "LOCALE",
      requestedBy,
      scope: {
        entityType: "PRODUCT",
        entityId: scope.productId,
        ...(shopifyLocale ? { locale: shopifyLocale } : {}),
      },
    });
    return {
      ok: true,
      warning: translationRun.run?.error ?? undefined,
      runId: translationRun.run?.id ?? null,
    };
  }

  if (scope.kind === "collection") {
    // PR4 adds refreshShopifyCollectionState — until merged, translation + presence only.
    const shopifyLocale = scope.locale ? await resolveShopifyLocale(scope.locale) : null;
    if (scope.locale && !shopifyLocale) {
      return {
        ok: true,
        warning: `Locale ${scope.locale} is not published in Shopify Markets.`,
        runId: null,
      };
    }
    const translationRun = await runTranslationReconciliation({
      trigger: "LOCALE",
      requestedBy,
      scope: {
        entityType: "COLLECTION",
        entityId: scope.collectionId,
        ...(shopifyLocale ? { locale: shopifyLocale } : {}),
      },
    });
    return {
      ok: true,
      warning: translationRun.run?.error
        ?? "Collection commerce refresh awaits sync-unification PR4 (#245).",
      runId: translationRun.run?.id ?? null,
    };
  }

  if (scope.kind === "collections") {
    const translationRun = await runTranslationReconciliation({
      trigger: "MANUAL",
      requestedBy,
      scope: { entityType: "COLLECTION" },
    });
    try {
      await scanAndSaveCollectionPresence(translationRun.run?.id ?? null);
    } catch (error) {
      await getLatestCollectionPresenceDifferences();
      warnings.push(error instanceof Error ? error.message : "Collection presence could not be checked.");
    }
    if (translationRun.run?.error) warnings.push(translationRun.run.error);
    warnings.push("Collection commerce refresh awaits sync-unification PR4 (#245).");
    return {
      ok: true,
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      runId: translationRun.run?.id ?? null,
    };
  }

  // catalog
  const translationRun = await runTranslationReconciliation({ trigger: "MANUAL", requestedBy });
  try {
    await scanAndSaveCatalogPresence(translationRun.run?.id ?? null);
  } catch (error) {
    await getLatestCatalogPresenceDifferences();
    warnings.push(error instanceof Error ? error.message : "Catalog presence could not be checked.");
  }

  const linkedProducts = await db.product.findMany({
    where: { shopifyProductId: { not: null } },
    select: { shopifyProductId: true },
    orderBy: { createdAt: "asc" },
  });
  // Sequential: explicit admin check — prefer predictable Shopify throttling.
  for (const product of linkedProducts) {
    if (!product.shopifyProductId) continue;
    try {
      await refreshShopifyProductState(product.shopifyProductId);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Product Shopify refresh failed.");
    }
  }

  if (translationRun.run?.error) warnings.push(translationRun.run.error);
  return {
    ok: true,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
    runId: translationRun.run?.id ?? null,
  };
}
