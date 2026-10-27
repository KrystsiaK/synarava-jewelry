"use server";

import { revalidatePath } from "next/cache";

import {
  createProductMetafieldDefinition,
  listCustomProductMetafieldDefinitions,
  listProductMetafieldDefinitions,
} from "@/lib/shopify/product-metafields-admin";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import {
  assertWholeRecordFingerprintsFresh,
  type CatalogConflictApplyEntryInput,
  type CatalogConflictApplyScope,
  type WholeRecordFingerprintExpectation,
} from "@/lib/shopify/catalog-conflict-apply";
import {
  fetchShopifyShopIdentity,
  hasShopifyAdminConfig,
} from "@/lib/shopify/admin";
import {
  assertShopifyStoreBinding,
} from "@/lib/shopify/store-binding";
import {
  applyShopifyProductToSynarava,
  inspectProductSyncState,
  pushProductToShopify,
  type PushProductToShopifyOptions,
} from "@/lib/shopify/product-sync";
import { revalidateStorefront } from "./shared";
import { getSavedProductPayload } from "./products";
import { runAfterSaveCatalogConflictCheck } from "@/lib/shopify/after-save-catalog-check";
import { removeCatalogPresenceDifference } from "@/lib/shopify/catalog-presence-server";
import {
  type CollectionConflictApplyEntryInput,
  type CollectionConflictApplyScope,
} from "@/lib/shopify/collection-conflict-apply";
import { markIncomingProductUpdateViewed } from "@/lib/shopify/catalog-conflict-review";
import {
  applyResolution,
  loadEntityConflict,
  loadSignals,
  previewResolution,
} from "@/lib/sync/conflicts/service";

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

export async function loadCatalogConflictSignalsAction() {
  const session = await requireAdminSession("/admin/products");
  return loadSignals("product", session.username);
}

/** Display-only: SyncResult leaves via waterfall skipRefresh — NO Shopify fetch. */
export async function loadProductCatalogConflictAction(productId: string) {
  const session = await requireAdminSession("/admin/products");
  return loadEntityConflict("product", productId, session.username);
}

/** Merchant-owned PRODUCT metafield definitions (excludes synarava passport + shopify taxonomy). */
export async function listCustomProductMetafieldDefinitionsAction() {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    const definitions = listCustomProductMetafieldDefinitions(await listProductMetafieldDefinitions());
    return { definitions };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load metafield definitions." };
  }
}

/** Shopify Admin “Add definition” for PRODUCT owner type (shop-wide schema, not product sync). */
export async function createProductMetafieldDefinitionAction(input: {
  name: string;
  key?: string;
  namespace?: string;
  type?: string;
  description?: string;
}) {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    const definition = await createProductMetafieldDefinition(input);
    revalidatePath("/admin/products");
    return { definition, success: `Definition “${definition.name}” created in Shopify.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create the metafield definition." };
  }
}

export async function loadCollectionConflictSignalsAction() {
  const session = await requireAdminSession("/admin/collections");
  return loadSignals("collection", session.username);
}

/** Display-only: SyncResult leaves via waterfall skipRefresh — NO Shopify fetch. */
export async function loadCollectionCatalogConflictAction(collectionId: string) {
  const session = await requireAdminSession("/admin/collections");
  return loadEntityConflict("collection", collectionId, session.username);
}

export async function previewCollectionConflictResolutionAction(scope: CollectionConflictApplyScope) {
  const session = await requireAdminSession("/admin/collections");
  return previewResolution("collection", scope, session.username);
}

export async function applyCollectionConflictResolutionAction(input: {
  entries: CollectionConflictApplyEntryInput[];
  acknowledgeClears: boolean;
}) {
  const session = await requireAdminSession("/admin/collections");
  return applyResolution("collection", input, session.username);
}

/** Resolves a bulk direction, a single product's direction, or a hand-picked manual field list into the concrete fields it would touch — nothing is written. See docs/wiki/catalog-conflict-resolution-ux.md dialogs 1-3. */
export async function previewCatalogConflictResolutionAction(scope: CatalogConflictApplyScope) {
  const session = await requireAdminSession("/admin/products");
  return previewResolution("product", scope, session.username);
}

/** Applies the entries a caller reviewed via previewCatalogConflictResolutionAction. Every entry is re-validated against the current conflict state before anything is written — a stale, already-resolved, or unacknowledged-clear entry is reported per-field rather than blocking the rest of the batch. */
export async function applyCatalogConflictResolutionAction(input: {
  entries: CatalogConflictApplyEntryInput[];
  acknowledgeClears: boolean;
}) {
  const session = await requireAdminSession("/admin/products");
  return applyResolution("product", input, session.username);
}

export async function markProductIncomingUpdateViewedAction(productId: string) {
  const session = await requireAdminSession(`/admin/products/${productId}`);
  await markIncomingProductUpdateViewed(productId, session.username);
  revalidatePath("/admin/products");
  return { success: true as const };
}

export async function pushSingleProductToShopifyAction(
  productId: string,
  options: PushProductToShopifyOptions = {},
  expectedFingerprints?: WholeRecordFingerprintExpectation[],
) {
  const authorizeCommerceConflictOverwrite = options.authorizeCommerceConflictOverwrite === true;
  const pushRegisteredTranslations = options.pushRegisteredTranslations !== false;
  const session = await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    await assertConfiguredShopifyStore();
    if (expectedFingerprints && expectedFingerprints.length > 0) {
      const fresh = await assertWholeRecordFingerprintsFresh({
        productId,
        expected: expectedFingerprints,
        actorUsername: session.username,
      });
      if (!fresh.ok) return { error: fresh.error };
    }
    const before = await inspectProductSyncState(productId);
    if (!authorizeCommerceConflictOverwrite && before.state === "CONFLICT") {
      return { error: "Shopify has newer changes. Review the conflict before pushing.", inspection: before };
    }
    if (before.state === "REMOTE_MISSING") {
      return { error: "The linked Shopify product no longer exists.", inspection: before };
    }
    const wasUnlinked = before.state === "UNLINKED";
    const result = await pushProductToShopify(productId, {
      authorizeCommerceConflictOverwrite,
      pushRegisteredTranslations,
    });
    if (!result.ok) return { error: result.error, inspection: before };
    // After Create in Shopify: clear that product's presence row without a catalog scan.
    if (wasUnlinked) {
      await removeCatalogPresenceDifference(productId);
    }
    // Invalidate at the write — before scoped recheck (recheck must not gate caches).
    revalidateStorefront();
    revalidatePath("/admin/products");
    await runAfterSaveCatalogConflictCheck(session.username, {
      kind: "product",
      productId,
    });
    const product = await getSavedProductPayload(productId);
    return {
      success: result.translationError
        ? "Commerce changes pushed to Shopify; one or more translations need attention."
        : pushRegisteredTranslations
          ? "Commerce and registered translations pushed to Shopify."
          : "Commerce changes pushed to Shopify.",
      translationWarning: result.translationError,
      product,
      inspection: await inspectProductSyncState(productId),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Shopify push failed." };
  }
}

export async function pullSingleProductFromShopifyAction(
  productId: string,
  force = false,
  expectedFingerprints?: WholeRecordFingerprintExpectation[],
) {
  const session = await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    await assertConfiguredShopifyStore();
    if (expectedFingerprints && expectedFingerprints.length > 0) {
      const fresh = await assertWholeRecordFingerprintsFresh({
        productId,
        expected: expectedFingerprints,
        actorUsername: session.username,
      });
      if (!fresh.ok) return { error: fresh.error };
    }
    const product = await db.product.findUnique({ where: { id: productId }, select: { shopifyProductId: true } });
    if (!product?.shopifyProductId) return { error: "This product is not linked to Shopify." };
    const before = await inspectProductSyncState(productId);
    if (!force && before.state === "CONFLICT") {
      return { error: "Saved local commerce changes would be replaced. Review the conflict before pulling.", inspection: before };
    }
    if (before.state === "REMOTE_MISSING") {
      return { error: "The linked Shopify product no longer exists.", inspection: before };
    }
    const pullResult = await applyShopifyProductToSynarava(product.shopifyProductId, undefined, force);
    // Invalidate at the write — before scoped recheck (recheck must not gate caches).
    revalidateStorefront();
    revalidatePath("/admin/products");
    if (pullResult.status === "SYNCED") {
      await runAfterSaveCatalogConflictCheck(session.username, {
        kind: "product",
        productId,
      });
    }
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
