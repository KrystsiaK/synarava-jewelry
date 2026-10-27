/**
 * Waterfall step 1 — fetch + persist Shopify copy only.
 * Never writes Synarava columns / extras / translations.
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
import { measureMs } from "@/lib/shopify/admin-telemetry";

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

/** Phase timings for waterfall summary logs (counts only — no resource IDs). */
export type RefreshShopifyStateTiming = {
  trigger: string | null;
  translationsMs: number;
  productPresenceMs: number;
  collectionPresenceMs: number;
  productCommerceMs: number;
  collectionCommerceMs: number;
  linkedProductCount: number;
  linkedCollectionCount: number;
  translationBindingCount: number;
  localeCount: number;
  warningCount: number;
  status: string;
  refreshMs: number;
};

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
  timing?: RefreshShopifyStateTiming;
};

export type RefreshShopifyStateOptions = {
  /** Full-catalog top-bar AUTO/MANUAL; defaults to MANUAL. */
  trigger?: "AUTO" | "MANUAL";
};

function baseTiming(trigger: string | null, status: string, refreshMs: number, warningCount = 0): RefreshShopifyStateTiming {
  return {
    trigger,
    translationsMs: 0,
    productPresenceMs: 0,
    collectionPresenceMs: 0,
    productCommerceMs: 0,
    collectionCommerceMs: 0,
    linkedProductCount: 0,
    linkedCollectionCount: 0,
    translationBindingCount: 0,
    localeCount: 0,
    warningCount,
    status,
    refreshMs,
  };
}

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
  const refreshStarted = performance.now();
  if (!hasShopifyAdminConfig()) {
    return {
      ok: false,
      warning: "Shopify Admin API credentials are not configured.",
      runId: null,
      timing: baseTiming(options?.trigger ?? null, "unconfigured", 0),
    };
  }

  const warnings: string[] = [];
  const catalogTrigger = options?.trigger ?? "MANUAL";
  const elapsed = () => Math.round(performance.now() - refreshStarted);

  if (scope.kind === "product") {
    const product = await db.product.findUnique({
      where: { id: scope.productId },
      select: { shopifyProductId: true },
    });
    let productCommerceMs = 0;
    if (product?.shopifyProductId) {
      productCommerceMs = (await measureMs(() => refreshShopifyProductState(product.shopifyProductId!))).ms;
    }
    const shopifyLocale = scope.locale ? await resolveShopifyLocale(scope.locale) : null;
    if (scope.locale && !shopifyLocale) {
      // Unpublished registry locale: skip translation refresh; surface honestly.
      return {
        ok: true,
        runId: null,
        warning: "translations not rechecked",
        timing: {
          ...baseTiming("LOCALE", "translations_skipped", elapsed(), 1),
          productCommerceMs,
          linkedProductCount: product?.shopifyProductId ? 1 : 0,
        },
      };
    }
    const translationTimed = await measureMs(() => runTranslationReconciliation({
      trigger: "LOCALE",
      requestedBy,
      scope: {
        entityType: "PRODUCT",
        entityId: scope.productId,
        ...(shopifyLocale ? { locale: shopifyLocale } : {}),
      },
    }));
    const translationRun = translationTimed.value;
    // Audit ~96-100 / reconciliation-run ~536: do not report ok:true silently
    // when another check holds the lease.
    if (translationRun.reused && translationRun.reason === "already_running") {
      return {
        ok: true,
        alreadyRunning: true,
        warning: "already running",
        runId: translationRun.run?.id ?? null,
        timing: {
          ...baseTiming("LOCALE", "already_running", elapsed(), 1),
          translationsMs: translationTimed.ms,
          productCommerceMs,
          linkedProductCount: product?.shopifyProductId ? 1 : 0,
        },
      };
    }
    const warning = translationRun.run?.error ?? undefined;
    return {
      ok: true,
      warning,
      runId: translationRun.run?.id ?? null,
      timing: {
        ...baseTiming("LOCALE", warning ? "PARTIAL" : "SUCCEEDED", elapsed(), warning ? 1 : 0),
        translationsMs: translationTimed.ms,
        productCommerceMs,
        linkedProductCount: product?.shopifyProductId ? 1 : 0,
      },
    };
  }

  if (scope.kind === "collection") {
    const collection = await db.collection.findUnique({
      where: { id: scope.collectionId },
      select: { shopifyCollectionId: true },
    });
    let collectionCommerceMs = 0;
    if (collection?.shopifyCollectionId) {
      collectionCommerceMs = (await measureMs(() => refreshShopifyCollectionState(collection.shopifyCollectionId!))).ms;
    }
    const shopifyLocale = scope.locale ? await resolveShopifyLocale(scope.locale) : null;
    if (scope.locale && !shopifyLocale) {
      return {
        ok: true,
        runId: null,
        warning: "translations not rechecked",
        timing: {
          ...baseTiming("LOCALE", "translations_skipped", elapsed(), 1),
          collectionCommerceMs,
          linkedCollectionCount: collection?.shopifyCollectionId ? 1 : 0,
        },
      };
    }
    const translationTimed = await measureMs(() => runTranslationReconciliation({
      trigger: "LOCALE",
      requestedBy,
      scope: {
        entityType: "COLLECTION",
        entityId: scope.collectionId,
        ...(shopifyLocale ? { locale: shopifyLocale } : {}),
      },
    }));
    const translationRun = translationTimed.value;
    if (translationRun.reused && translationRun.reason === "already_running") {
      return {
        ok: true,
        alreadyRunning: true,
        warning: "already running",
        runId: translationRun.run?.id ?? null,
        timing: {
          ...baseTiming("LOCALE", "already_running", elapsed(), 1),
          translationsMs: translationTimed.ms,
          collectionCommerceMs,
          linkedCollectionCount: collection?.shopifyCollectionId ? 1 : 0,
        },
      };
    }
    const warning = translationRun.run?.error ?? undefined;
    return {
      ok: true,
      warning,
      runId: translationRun.run?.id ?? null,
      timing: {
        ...baseTiming("LOCALE", warning ? "PARTIAL" : "SUCCEEDED", elapsed(), warning ? 1 : 0),
        translationsMs: translationTimed.ms,
        collectionCommerceMs,
        linkedCollectionCount: collection?.shopifyCollectionId ? 1 : 0,
      },
    };
  }

  if (scope.kind === "collections") {
    const translationTimed = await measureMs(() => runTranslationReconciliation({
      trigger: "MANUAL",
      requestedBy,
      scope: { entityType: "COLLECTION" },
    }));
    const translationRun = translationTimed.value;
    if (translationRun.reused && translationRun.reason === "already_running") {
      return {
        ok: true,
        alreadyRunning: true,
        warning: "already running",
        runId: translationRun.run?.id ?? null,
        timing: baseTiming("MANUAL", "already_running", elapsed(), 1),
      };
    }
    const presenceTimed = await measureMs(async () => {
      try {
        await scanAndSaveCollectionPresence(translationRun.run?.id ?? null);
        if (translationRun.run?.id) {
          await heartbeatCatalogCheckRun(translationRun.run.id);
        }
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Collection presence could not be checked.");
      }
    });

    const linkedCollections = await db.collection.findMany({
      where: { shopifyCollectionId: { not: null } },
      select: { shopifyCollectionId: true },
      orderBy: { createdAt: "asc" },
    });
    // Sequential: same throttling preference as catalog products.
    const commerceTimed = await measureMs(async () => {
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
    });

    if (translationRun.run?.error) warnings.push(translationRun.run.error);
    return {
      ok: true,
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      runId: translationRun.run?.id ?? null,
      timing: {
        ...baseTiming("MANUAL", warnings.length > 0 ? "PARTIAL" : "SUCCEEDED", elapsed(), warnings.length),
        translationsMs: translationTimed.ms,
        collectionPresenceMs: presenceTimed.ms,
        collectionCommerceMs: commerceTimed.ms,
        linkedCollectionCount: linkedCollections.length,
      },
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
      timing: baseTiming(catalogTrigger, "already_running", elapsed(), 1),
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
      timing: baseTiming(catalogTrigger, "reused", elapsed()),
    };
  }

  const runId = began.run.id;
  let checkedCount = 0;
  let differenceCount = 0;
  const timing = baseTiming(catalogTrigger, "RUNNING", 0);
  try {
    try {
      timing.translationBindingCount = await db.shopifyTranslationBinding.count();
    } catch { /* telemetry only */ }
    try {
      timing.localeCount = (await getPublishedStorefrontLocales()).length;
    } catch { /* telemetry only */ }

    const translationTimed = await measureMs(() => runTranslationReconciliation({
      trigger: catalogTrigger,
      requestedBy,
      attachToRunId: runId,
    }));
    timing.translationsMs = translationTimed.ms;
    const translationRun = translationTimed.value;
    checkedCount = translationRun.checkedCount ?? 0;
    differenceCount = translationRun.differenceCount ?? 0;
    if (translationRun.translationError) warnings.push(translationRun.translationError);

    timing.productPresenceMs = (await measureMs(async () => {
      try {
        await scanAndSaveCatalogPresence(runId);
        await heartbeatCatalogCheckRun(runId);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Catalog presence could not be checked.");
      }
    })).ms;
    timing.collectionPresenceMs = (await measureMs(async () => {
      try {
        await scanAndSaveCollectionPresence(runId);
        await heartbeatCatalogCheckRun(runId);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Collection presence could not be checked.");
      }
    })).ms;

    const linkedProducts = await db.product.findMany({
      where: { shopifyProductId: { not: null } },
      select: { shopifyProductId: true },
      orderBy: { createdAt: "asc" },
    });
    timing.linkedProductCount = linkedProducts.length;
    // Sequential: explicit admin check — prefer predictable Shopify throttling.
    timing.productCommerceMs = (await measureMs(async () => {
      for (const product of linkedProducts) {
        if (!product.shopifyProductId) continue;
        try {
          await refreshShopifyProductState(product.shopifyProductId);
          await heartbeatCatalogCheckRun(runId);
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : "Product Shopify refresh failed.");
        }
      }
    })).ms;

    const linkedCollections = await db.collection.findMany({
      where: { shopifyCollectionId: { not: null } },
      select: { shopifyCollectionId: true },
      orderBy: { createdAt: "asc" },
    });
    timing.linkedCollectionCount = linkedCollections.length;
    timing.collectionCommerceMs = (await measureMs(async () => {
      for (const collection of linkedCollections) {
        if (!collection.shopifyCollectionId) continue;
        try {
          await refreshShopifyCollectionState(collection.shopifyCollectionId);
          await heartbeatCatalogCheckRun(runId);
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : "Collection Shopify refresh failed.");
        }
      }
    })).ms;

    const translationStatus = translationRun.translationStatus ?? "SUCCEEDED";
    const intendedStatus = warnings.length > 0 && translationStatus === "FAILED"
      ? "FAILED"
      : warnings.length > 0 || translationStatus === "PARTIAL"
        ? "PARTIAL"
        : "SUCCEEDED";
    // Audit ~255-266: use status actually written — a lost lease is a no-op
    // finish that must not stamp checkedAt as SUCCEEDED.
    const finished = await finishCatalogCheckRun(runId, {
      status: intendedStatus,
      checkedCount,
      differenceCount,
      error: warnings.length > 0 ? warnings.join(" ") : null,
    });
    const runStatus = finished?.status === "SUCCEEDED"
      || finished?.status === "PARTIAL"
      || finished?.status === "FAILED"
      ? finished.status
      : null;
    timing.warningCount = warnings.length;
    timing.status = runStatus ?? intendedStatus;
    timing.refreshMs = elapsed();
    return {
      ok: true,
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      runId,
      runStatus,
      timing,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finished = await finishCatalogCheckRun(runId, {
      status: "FAILED",
      checkedCount,
      differenceCount,
      error: message,
    });
    const runStatus = finished?.status === "FAILED"
      || finished?.status === "PARTIAL"
      || finished?.status === "SUCCEEDED"
      ? finished.status
      : "FAILED";
    timing.warningCount = warnings.length + 1;
    timing.status = runStatus;
    timing.refreshMs = elapsed();
    return { ok: false, warning: message, runId, runStatus, timing };
  }
}
