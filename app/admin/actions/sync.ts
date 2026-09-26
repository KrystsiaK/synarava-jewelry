"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import {
  applyCatalogConflictResolution,
  previewCatalogConflictResolution,
  type CatalogConflictApplyEntryInput,
  type CatalogConflictApplyScope,
} from "@/lib/shopify/catalog-conflict-apply";
import {
  fetchShopifyShopIdentity,
  hasShopifyAdminConfig,
  testShopifyAdminConnection,
  type MissingLocalePublication,
} from "@/lib/shopify/admin";
import {
  assertShopifyStoreBinding,
  ensureShopifyStoreBinding,
  rebindShopifyStore,
} from "@/lib/shopify/store-binding";
import {
  ensureProductWebhookSubscriptions,
  inspectProductSyncState,
  pullShopifyProduct,
  pushProductToShopify,
} from "@/lib/shopify/product-sync";
import { pullCatalogFromShopify } from "@/lib/shopify/catalog-pull";
import { ensureProductReviewWebhookSubscriptions } from "@/lib/shopify/product-reviews";
import { env } from "@/lib/env";
import { revalidateStorefront } from "./shared";
import { getSavedProductPayload } from "./products";
import { runCatalogConflictCheck, runProductConflictCheck, getCatalogConflictSignals, getCollectionConflictSignals, runCollectionConflictCheck, runCollectionsConflictCheck } from "@/lib/shopify/catalog-conflict-signals-server";
import { getProductCatalogConflict } from "@/lib/shopify/catalog-conflict";
import { getCollectionCatalogConflict } from "@/lib/shopify/collection-conflict";
import {
  applyCollectionConflictResolution,
  previewCollectionConflictResolution,
  type CollectionConflictApplyEntryInput,
  type CollectionConflictApplyScope,
} from "@/lib/shopify/collection-conflict-apply";
import { markIncomingProductUpdates, markIncomingProductUpdateViewed } from "@/lib/shopify/catalog-conflict-review";

/** One sentence naming every registered translation locale Shopify hasn't enabled/published yet, or "" if none. */
function translationLocaleNotice(missingTranslationScopes: string[], unpublishedLocales: MissingLocalePublication[]) {
  if (missingTranslationScopes.length > 0) {
    return ` Translation sync is unavailable: missing ${missingTranslationScopes.join(", ")}.`;
  }
  if (unpublishedLocales.length === 0) return "";
  const names = unpublishedLocales.map((locale) => `${locale.name} (${locale.shopifyLocale})`).join(", ");
  return ` ${names} ${unpublishedLocales.length === 1 ? "is" : "are"} not enabled/published in Shopify Markets; translation sync will be skipped for ${unpublishedLocales.length === 1 ? "it" : "them"}.`;
}

async function assertConfiguredShopifyStore() {
  const shop = await fetchShopifyShopIdentity();
  await assertShopifyStoreBinding(shop.myshopifyDomain);
  return shop;
}

export async function inspectProductSyncAction(productId: string) {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    return { inspection: await inspectProductSyncState(productId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not inspect Shopify changes." };
  }
}

/**
 * Stepped dual-store actions — client logs each step in the browser console.
 */
export async function buildOurCommerceStoreAction() {
  await requireAdminSession("/admin/products");
  try {
    const { buildOurCommerceStore } = await import("@/lib/commerce-store/build-our-store");
    return { our: await buildOurCommerceStore() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not build OUR commerce store." };
  }
}

export async function fetchShopifyCommerceStoreAction() {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) {
    return { error: "Shopify Admin API credentials are not configured." };
  }
  try {
    const { fetchShopifyCommerceStore } = await import("@/lib/commerce-store/fetch-shopify-store");
    return { shopify: await fetchShopifyCommerceStore() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not fetch SHOPIFY commerce store." };
  }
}

export async function compareAndPersistCommerceStoresAction(
  our: import("@/lib/commerce-store/types").CommerceStore,
  shopify: import("@/lib/commerce-store/types").CommerceStore,
) {
  await requireAdminSession("/admin/products");
  try {
    const { persistComparedCommerceStores } = await import("@/lib/commerce-store/refresh");
    const result = await persistComparedCommerceStores(our, shopify);
    return {
      conflicts: result.conflicts,
      debug: result.debug,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not compare/persist commerce stores." };
  }
}

/**
 * Full dual-store refresh (single round-trip). Prefer stepped actions for console flow.
 */
export async function refreshCommerceSyncStoreAction() {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) {
    return { error: "Shopify Admin API credentials are not configured." };
  }
  try {
    const { refreshCommerceSyncStore } = await import("@/lib/commerce-store/refresh");
    const result = await refreshCommerceSyncStore();
    return {
      debug: result.debug,
      our: result.our,
      shopify: result.shopify,
      conflicts: result.conflicts,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not refresh commerce sync store." };
  }
}

export async function checkCatalogConflictsAction() {
  const session = await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) {
    const missingVariables = [
      !env.SHOPIFY_STORE_DOMAIN ? "SHOPIFY_STORE_DOMAIN" : null,
      !env.SHOPIFY_CLIENT_ID && !env.SHOPIFY_ADMIN_ACCESS_TOKEN ? "SHOPIFY_CLIENT_ID" : null,
      !env.SHOPIFY_CLIENT_SECRET && !env.SHOPIFY_ADMIN_ACCESS_TOKEN ? "SHOPIFY_CLIENT_SECRET" : null,
    ].filter((value): value is string => Boolean(value));
    return { error: `Shopify Admin API is not configured. Missing: ${missingVariables.join(", ")}.` };
  }
  try {
    const connection = await testShopifyAdminConnection();
    if (connection.missingScopes.length > 0) {
      return { error: `Connected to ${connection.shopName}, but required scopes are missing: ${connection.missingScopes.join(", ")}.` };
    }
    const binding = await ensureShopifyStoreBinding(connection.shopDomain);
    if (binding.status === "MISMATCH") {
      return {
        error: `This catalog is linked to ${binding.boundShopDomain}, while the current credentials point to ${binding.currentShopDomain}. Rebind before checking conflicts.`,
        storeMismatch: {
          boundShopDomain: binding.boundShopDomain,
          currentShopDomain: binding.currentShopDomain,
        },
      };
    }

    const notices: string[] = [];
    const translationNotice = translationLocaleNotice(connection.missingTranslationScopes, connection.unpublishedLocales).trim();
    if (translationNotice) notices.push(translationNotice);
    if (env.APP_URL && env.SHOPIFY_WEBHOOK_SECRET) {
      try {
        await ensureProductWebhookSubscriptions(env.APP_URL);
      } catch (error) {
        notices.push(`Product webhooks could not be configured: ${error instanceof Error ? error.message : "unknown Shopify error"}.`);
      }
    } else {
      notices.push("Automatic product updates are unavailable until APP_URL and SHOPIFY_WEBHOOK_SECRET are configured.");
    }
    if (connection.missingReviewScopes.length > 0) {
      notices.push(`Product review publishing is unavailable: missing ${connection.missingReviewScopes.join(", ")}.`);
    } else if (!env.APP_URL || !env.SHOPIFY_WEBHOOK_SECRET) {
      notices.push("Product review publishing is unavailable until APP_URL and SHOPIFY_WEBHOOK_SECRET are configured.");
    } else {
      try {
        await ensureProductReviewWebhookSubscriptions(env.APP_URL);
      } catch (error) {
        notices.push(`Product review webhooks could not be configured: ${error instanceof Error ? error.message : "unknown Shopify error"}.`);
      }
    }
    if (connection.missingWishlistScopes.length > 0) {
      notices.push(`Customer wishlist saving is unavailable: missing ${connection.missingWishlistScopes.join(", ")}.`);
    }

    const result = await runCatalogConflictCheck(session.username);
    revalidatePath("/admin/products");
    return {
      ...result,
      warning: [result.warning, ...notices].filter(Boolean).join(" ") || undefined,
      success: result.signals.totalCount === 0
        ? "Conflict check complete. No conflicts found."
        : `Conflict check complete. Review ${result.signals.totalCount} product${result.signals.totalCount === 1 ? "" : "s"} in the conflict list.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not check catalog conflicts." };
  }
}

/** Scoped product(+locale) conflict check — same engine as catalog, not a full catalog sweep. */
export async function checkProductConflictsAction(input: { productId: string; locale?: string }) {
  const session = await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  if (!input.productId.trim()) return { error: "Product id is required." };
  try {
    const result = await runProductConflictCheck({
      productId: input.productId,
      locale: input.locale,
      requestedBy: session.username,
    });
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${input.productId}`);
    return {
      ...result,
      success: result.signals.totalCount === 0
        ? "Conflict check complete. No conflicts found."
        : `Conflict check complete. ${result.signals.totalCount} product${result.signals.totalCount === 1 ? "" : "s"} need a decision.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not check product conflicts." };
  }
}

export async function loadCatalogConflictSignalsAction() {
  const session = await requireAdminSession("/admin/products");
  try {
    return { signals: await getCatalogConflictSignals(session.username) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load conflict status." };
  }
}

export async function loadProductCatalogConflictAction(productId: string) {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    return { conflict: await getProductCatalogConflict(productId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load this product's conflict details." };
  }
}

export async function checkCollectionConflictsAction() {
  const session = await requireAdminSession("/admin/collections");
  if (!hasShopifyAdminConfig()) {
    return { error: "Shopify Admin API is not configured." };
  }
  try {
    const connection = await testShopifyAdminConnection();
    if (connection.missingScopes.length > 0) {
      return { error: `Connected to ${connection.shopName}, but required scopes are missing: ${connection.missingScopes.join(", ")}.` };
    }
    const binding = await ensureShopifyStoreBinding(connection.shopDomain);
    if (binding.status === "MISMATCH") {
      return {
        error: `This catalog is linked to ${binding.boundShopDomain}, while the current credentials point to ${binding.currentShopDomain}. Rebind from Products before checking collection conflicts.`,
        storeMismatch: {
          boundShopDomain: binding.boundShopDomain,
          currentShopDomain: binding.currentShopDomain,
        },
      };
    }
    const notices: string[] = [];
    const translationNotice = translationLocaleNotice(connection.missingTranslationScopes, connection.unpublishedLocales).trim();
    if (translationNotice) notices.push(translationNotice);

    const result = await runCollectionsConflictCheck(session.username);
    revalidatePath("/admin/collections");
    return {
      ...result,
      warning: [result.warning, ...notices].filter(Boolean).join(" ") || undefined,
      success: result.signals.totalCount === 0
        ? "Conflict check complete. No collection conflicts found."
        : `Conflict check complete. Review ${result.signals.totalCount} collection${result.signals.totalCount === 1 ? "" : "s"} in the conflict list.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not check collection conflicts." };
  }
}

export async function checkOneCollectionConflictsAction(input: { collectionId: string; locale?: string }) {
  const session = await requireAdminSession("/admin/collections");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  if (!input.collectionId.trim()) return { error: "Collection id is required." };
  try {
    const result = await runCollectionConflictCheck({
      collectionId: input.collectionId,
      locale: input.locale,
      requestedBy: session.username,
    });
    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${input.collectionId}`);
    return {
      ...result,
      success: result.signals.totalCount === 0
        ? "Conflict check complete. No conflicts found."
        : `Conflict check complete. ${result.signals.totalCount} collection${result.signals.totalCount === 1 ? "" : "s"} need a decision.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not check collection conflicts." };
  }
}

export async function loadCollectionConflictSignalsAction() {
  await requireAdminSession("/admin/collections");
  try {
    return { signals: await getCollectionConflictSignals() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load conflict status." };
  }
}

export async function loadCollectionCatalogConflictAction(collectionId: string) {
  await requireAdminSession("/admin/collections");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    return { conflict: await getCollectionCatalogConflict(collectionId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load this collection's conflict details." };
  }
}

export async function previewCollectionConflictResolutionAction(scope: CollectionConflictApplyScope) {
  await requireAdminSession("/admin/collections");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    return { preview: await previewCollectionConflictResolution(scope) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not preview the conflict resolution." };
  }
}

export async function applyCollectionConflictResolutionAction(input: {
  entries: CollectionConflictApplyEntryInput[];
  acknowledgeClears: boolean;
}) {
  const session = await requireAdminSession("/admin/collections");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    const outcome = await applyCollectionConflictResolution({ ...input, actorUsername: session.username });
    after(() => {
      revalidateStorefront();
      revalidatePath("/admin/collections");
      for (const collectionId of new Set(input.entries.map((entry) => entry.collectionId))) {
        revalidatePath(`/admin/collections/${collectionId}`);
      }
    });
    return {
      outcome,
      success: outcome.appliedCount > 0
        ? `${outcome.appliedCount} change${outcome.appliedCount === 1 ? "" : "s"} applied${outcome.failedCount > 0 ? `; ${outcome.failedCount} could not be applied` : ""}.`
        : undefined,
      error: outcome.appliedCount === 0
        ? "None of the selected changes could be applied. Review the results below."
        : undefined,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not apply the conflict resolution." };
  }
}

/** Resolves a bulk direction, a single product's direction, or a hand-picked manual field list into the concrete fields it would touch — nothing is written. See docs/admin/catalog-conflict-resolution-ux.md dialogs 1-3. */
export async function previewCatalogConflictResolutionAction(scope: CatalogConflictApplyScope) {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    return { preview: await previewCatalogConflictResolution(scope) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not preview the conflict resolution." };
  }
}

/** Applies the entries a caller reviewed via previewCatalogConflictResolutionAction. Every entry is re-validated against the current conflict state before anything is written — a stale, already-resolved, or unacknowledged-clear entry is reported per-field rather than blocking the rest of the batch. */
export async function applyCatalogConflictResolutionAction(input: {
  entries: CatalogConflictApplyEntryInput[];
  acknowledgeClears: boolean;
}) {
  const session = await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    const outcome = await applyCatalogConflictResolution({ ...input, actorUsername: session.username });
    const incomingProductIds = new Set(
      outcome.results
        .filter((result) => result.ok && input.entries.some((entry) =>
          entry.productId === result.productId
          && entry.fieldKey === result.fieldKey
          && entry.direction === "SHOPIFY_TO_SYNARAVA",
        ))
        .map((result) => result.localProductId ?? result.productId)
        // Presence applies use virtual ids like `shopify:123` until pull creates
        // a local row — only watermark real Product ids (FK on ProductIncomingUpdate).
        .filter((productId) => Boolean(productId) && !productId.startsWith("shopify:")),
    );
    let warning: string | undefined;
    try {
      await markIncomingProductUpdates([...incomingProductIds]);
    } catch (error) {
      console.error("[catalog-conflicts] applied values but could not record the review watermark", error);
      warning = "Values were applied, but the new-from-Shopify review badge could not be saved.";
    }
    // Return write outcome immediately; cache refresh must not hold the client overlay.
    after(() => {
      revalidateStorefront();
      revalidatePath("/admin/products");
    });
    return {
      outcome,
      warning,
      success: outcome.appliedCount > 0
        ? `${outcome.appliedCount} change${outcome.appliedCount === 1 ? "" : "s"} applied${outcome.failedCount > 0 ? `; ${outcome.failedCount} could not be applied` : ""}.`
        : undefined,
      error: outcome.appliedCount === 0
        ? "None of the selected changes could be applied. Review the results below."
        : undefined,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not apply the conflict resolution." };
  }
}

export async function markProductIncomingUpdateViewedAction(productId: string) {
  const session = await requireAdminSession(`/admin/products/${productId}`);
  await markIncomingProductUpdateViewed(productId, session.username);
  revalidatePath("/admin/products");
  return { success: true as const };
}

export async function pushSingleProductToShopifyAction(productId: string, force = false) {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    await assertConfiguredShopifyStore();
    const before = await inspectProductSyncState(productId);
    if (!force && (before.state === "REMOTE_CHANGES" || before.state === "CONFLICT")) {
      return { error: "Shopify has newer changes. Review the conflict before pushing.", inspection: before };
    }
    if (before.state === "REMOTE_MISSING") {
      return { error: "The linked Shopify product no longer exists.", inspection: before };
    }
    const result = await pushProductToShopify(productId, force);
    if (!result.ok) return { error: result.error, inspection: before };
    const { refreshCommerceSyncStore } = await import("@/lib/commerce-store/refresh");
    await refreshCommerceSyncStore();
    revalidateStorefront();
    revalidatePath("/admin/products");
    const product = await getSavedProductPayload(productId);
    return {
      success: result.translationError
        ? "Commerce changes pushed to Shopify; one or more translations need attention."
        : "Commerce and registered translations pushed to Shopify.",
      translationWarning: result.translationError,
      product,
      inspection: await inspectProductSyncState(productId),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Shopify push failed." };
  }
}

export async function pullSingleProductFromShopifyAction(productId: string, force = false) {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    await assertConfiguredShopifyStore();
    const product = await db.product.findUnique({ where: { id: productId }, select: { shopifyProductId: true } });
    if (!product?.shopifyProductId) return { error: "This product is not linked to Shopify." };
    const before = await inspectProductSyncState(productId);
    if (!force && (before.state === "LOCAL_CHANGES" || before.state === "CONFLICT")) {
      return { error: "Saved local commerce changes would be replaced. Review the conflict before pulling.", inspection: before };
    }
    if (before.state === "REMOTE_MISSING") {
      return { error: "The linked Shopify product no longer exists.", inspection: before };
    }
    const pullResult = await pullShopifyProduct(product.shopifyProductId, undefined, force);
    const { refreshCommerceSyncStore } = await import("@/lib/commerce-store/refresh");
    await refreshCommerceSyncStore();
    revalidateStorefront();
    revalidatePath("/admin/products");
    const savedProduct = await getSavedProductPayload(productId);
    const inspection = await inspectProductSyncState(productId);
    if (pullResult.status !== "SYNCED") {
      return {
        error: pullResult.status === "LOCAL_CHANGES"
          ? "Shopify pull skipped. Saved local commerce changes are newer than Shopify."
          : "Shopify pull did not apply. Commerce identity or fields conflict; review them before pulling again.",
        product: savedProduct,
        inspection,
      };
    }
    return {
      success: pullResult.translationStatus === "CONFLICT"
        ? "Shopify commerce data pulled. One or more translations have edits on both sides; choose Pull or Push to resolve them."
        : pullResult.translationStatus === "UNAVAILABLE"
          ? "Shopify commerce data pulled, but one or more translations could not be read. Check read_translations access."
          : "Latest Shopify commerce and registered translations pulled. Synarava-only editorial fields were preserved.",
      translationWarning: pullResult.translationStatus === "CONFLICT" || pullResult.translationStatus === "UNAVAILABLE",
      product: savedProduct,
      inspection,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Shopify pull failed." };
  }
}

/**
 * Shopify Products page: import Shopify-only products and refresh every linked
 * local projection from Shopify (force pull).
 */
export async function updateShopifyProductsAction() {
  await requireAdminSession("/admin/shopify-products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    const connection = await testShopifyAdminConnection();
    if (connection.missingScopes.length > 0) {
      return {
        error: `Connected to ${connection.shopName}, but required scopes are missing: ${connection.missingScopes.join(", ")}.`,
      };
    }
    const binding = await ensureShopifyStoreBinding(connection.shopDomain);
    if (binding.status === "MISMATCH") {
      return {
        error: `This catalog is linked to ${binding.boundShopDomain}, while the current credentials point to ${binding.currentShopDomain}. Rebind the store from Catalog before updating.`,
        storeMismatch: {
          boundShopDomain: binding.boundShopDomain,
          currentShopDomain: binding.currentShopDomain,
        },
      };
    }

    if (env.APP_URL && env.SHOPIFY_WEBHOOK_SECRET) {
      try {
        await ensureProductWebhookSubscriptions(env.APP_URL);
      } catch {
        // Webhook setup is best-effort; update still proceeds.
      }
    }

    const summary = await pullCatalogFromShopify();
    revalidateStorefront();
    revalidatePath("/admin/shopify-products");
    revalidatePath("/admin/products");

    if (summary.failed > 0 && summary.imported === 0 && summary.refreshed === 0) {
      return {
        error: summary.errors[0] ?? "Could not update products from Shopify.",
        summary,
      };
    }

    const parts = [
      summary.imported > 0
        ? `imported ${summary.imported} new product${summary.imported === 1 ? "" : "s"}`
        : null,
      summary.refreshed > 0
        ? `refreshed ${summary.refreshed} linked product${summary.refreshed === 1 ? "" : "s"}`
        : null,
    ].filter(Boolean);

    return {
      success: parts.length > 0
        ? `Update from Shopify complete: ${parts.join(", ")}.`
        : "Update from Shopify complete. Local catalog already matched Shopify.",
      warning: summary.failed > 0
        ? `${summary.failed} product${summary.failed === 1 ? "" : "s"} could not be updated.`
        : undefined,
      summary,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update products from Shopify." };
  }
}

export async function rebindShopifyStoreAction(expectedShopDomain: string) {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };

  try {
    const connection = await testShopifyAdminConnection();
    if (connection.missingScopes.length > 0) {
      return { error: `The new Shopify store is missing scopes: ${connection.missingScopes.join(", ")}.` };
    }
    const result = await rebindShopifyStore(expectedShopDomain, connection.shopDomain);
    revalidatePath("/admin/products");
    const translationNotice = translationLocaleNotice(connection.missingTranslationScopes, connection.unpublishedLocales);
    return {
      success: `Catalog is now bound to ${result.shopDomain}. Product saves, Shopify webhooks, and conflict checks will establish the new store identities.${translationNotice}`,
      result,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Shopify store rebind failed." };
  }
}
