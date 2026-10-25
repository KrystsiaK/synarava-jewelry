/**
 * Waterfall step 1 — fetch + persist Shopify copy only.
 * Never writes Synarava columns / workingSnapshot / translations.
 */

import "server-only";

import { refreshShopifyProductState } from "@/lib/shopify/product-sync";
import { scanAndSaveCatalogPresence } from "@/lib/shopify/catalog-presence-server";
import {
  refreshShopifyCollectionState,
  scanAndSaveCollectionPresence,
} from "@/lib/shopify/collection-presence-server";
import {
  beginCatalogCheckRun,
  finishCatalogCheckRun,
  heartbeatCatalogCheckRun,
  runTranslationReconciliation,
} from "@/lib/shopify/reconciliation-run";
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
  /** Another full catalog check is already RUNNING/QUEUED (within lease). */
  alreadyRunning?: boolean;
  /** Recent AUTO reuse — caller must not stamp a new checkedAt. */
  reused?: boolean;
  /** Terminal status of the catalog run this refresh finished (if any). */
  runStatus?: "SUCCEEDED" | "PARTIAL" | "FAILED" | null;
};

export type RefreshShopifyStateOptions = {
  /** Full-catalog top-bar AUTO/MANUAL; defaults to MANUAL. */
  trigger?: "AUTO" | "MANUAL";
};

/**
 * Refresh Shopify-side state for the given scope.
 * Products and collections both refresh commerce windows via
 * `refreshShopifyProductState` / `refreshShopifyCollectionState`, then
 * translations (+ presence on catalog-wide scopes).
 *
 * Catalog scope is the full owner-model check: translations + product and
 * collection presence + every linked commerce window.
 */
export async function refreshShopifyState(
  scope: RefreshShopifyStateScope,
  requestedBy: string,
  options?: RefreshShopifyStateOptions,
): Promise<RefreshShopifyStateResult> {
  if (!hasShopifyAdminConfig()) {
    return { ok: false, warning: "Shopify Admin API credentials are not configured.", runId: null };
  }

  const warnings: string[] = [];
  const catalogTrigger = options?.trigger ?? "MANUAL";

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
      // Unpublished registry locale: skip translation refresh; surface honestly.
      return { ok: true, runId: null, warning: "translations not rechecked" };
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
    const collection = await db.collection.findUnique({
      where: { id: scope.collectionId },
      select: { shopifyCollectionId: true },
    });
    if (collection?.shopifyCollectionId) {
      await refreshShopifyCollectionState(collection.shopifyCollectionId);
    }
    const shopifyLocale = scope.locale ? await resolveShopifyLocale(scope.locale) : null;
    if (scope.locale && !shopifyLocale) {
      return { ok: true, runId: null, warning: "translations not rechecked" };
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
      warning: translationRun.run?.error ?? undefined,
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
      warnings.push(error instanceof Error ? error.message : "Collection presence could not be checked.");
    }

    const linkedCollections = await db.collection.findMany({
      where: { shopifyCollectionId: { not: null } },
      select: { shopifyCollectionId: true },
      orderBy: { createdAt: "asc" },
    });
    // Sequential: same throttling preference as catalog products.
    for (const collection of linkedCollections) {
      if (!collection.shopifyCollectionId) continue;
      try {
        await refreshShopifyCollectionState(collection.shopifyCollectionId);
        if (translationRun.run?.id) {
          await heartbeatCatalogCheckRun(translationRun.run.id);
        }
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Collection Shopify refresh failed.");
      }
    }

    if (translationRun.run?.error) warnings.push(translationRun.run.error);
    return {
      ok: true,
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      runId: translationRun.run?.id ?? null,
    };
  }

  // catalog — one full check: translations + both presence scans + all commerce windows.
  // Single-flight: ShopifyReconcileRun stays RUNNING until this whole path finishes.
  const began = await beginCatalogCheckRun({ trigger: catalogTrigger, requestedBy });
  if (began.status === "already_running") {
    return {
      ok: true,
      alreadyRunning: true,
      warning: "already running",
      runId: began.run.id,
    };
  }
  if (began.status === "reused_recent_auto") {
    return {
      ok: true,
      reused: true,
      runId: began.run.id,
      runStatus: began.run.status === "SUCCEEDED"
        || began.run.status === "PARTIAL"
        || began.run.status === "FAILED"
        ? began.run.status
        : null,
      warning: undefined,
    };
  }

  const runId = began.run.id;
  let checkedCount = 0;
  let differenceCount = 0;
  try {
    const translationRun = await runTranslationReconciliation({
      trigger: catalogTrigger,
      requestedBy,
      attachToRunId: runId,
    });
    checkedCount = translationRun.checkedCount ?? 0;
    differenceCount = translationRun.differenceCount ?? 0;
    if (translationRun.translationError) warnings.push(translationRun.translationError);

    try {
      await scanAndSaveCatalogPresence(runId);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Catalog presence could not be checked.");
    }
    try {
      await scanAndSaveCollectionPresence(runId);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Collection presence could not be checked.");
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
        await heartbeatCatalogCheckRun(runId);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Product Shopify refresh failed.");
      }
    }

    const linkedCollections = await db.collection.findMany({
      where: { shopifyCollectionId: { not: null } },
      select: { shopifyCollectionId: true },
      orderBy: { createdAt: "asc" },
    });
    for (const collection of linkedCollections) {
      if (!collection.shopifyCollectionId) continue;
      try {
        await refreshShopifyCollectionState(collection.shopifyCollectionId);
        await heartbeatCatalogCheckRun(runId);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Collection Shopify refresh failed.");
      }
    }

    const translationStatus = translationRun.translationStatus ?? "SUCCEEDED";
    const status = warnings.length > 0 && translationStatus === "FAILED"
      ? "FAILED"
      : warnings.length > 0 || translationStatus === "PARTIAL"
        ? "PARTIAL"
        : "SUCCEEDED";
    await finishCatalogCheckRun(runId, {
      status,
      checkedCount,
      differenceCount,
      error: warnings.length > 0 ? warnings.join(" ") : null,
    });
    return {
      ok: true,
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      runId,
      runStatus: status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishCatalogCheckRun(runId, {
      status: "FAILED",
      checkedCount,
      differenceCount,
      error: message,
    });
    return { ok: false, warning: message, runId, runStatus: "FAILED" };
  }
}
