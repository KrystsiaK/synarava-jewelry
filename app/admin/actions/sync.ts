"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import {
  createProductMetafieldDefinition,
  listCustomProductMetafieldDefinitions,
  listProductMetafieldDefinitions,
} from "@/lib/shopify/product-metafields-admin";

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
} from "@/lib/shopify/admin";
import {
  assertShopifyStoreBinding,
} from "@/lib/shopify/store-binding";
import { applyShopifyProductToSynarava, inspectProductSyncState, pushProductToShopify } from "@/lib/shopify/product-sync";
import { revalidateStorefront } from "./shared";
import { getSavedProductPayload } from "./products";
import { runProductConflictCheck, getCatalogConflictSignals, getCollectionConflictSignals } from "@/lib/shopify/catalog-conflict-signals-server";
import { getProductCatalogConflict } from "@/lib/shopify/catalog-conflict";
import { getCollectionCatalogConflict } from "@/lib/shopify/collection-conflict";
import {
  applyCollectionConflictResolution,
  previewCollectionConflictResolution,
  type CollectionConflictApplyEntryInput,
  type CollectionConflictApplyScope,
} from "@/lib/shopify/collection-conflict-apply";
import { markIncomingProductUpdates, markIncomingProductUpdateViewed } from "@/lib/shopify/catalog-conflict-review";

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
  try {
    return { signals: await getCatalogConflictSignals(session.username) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load conflict status." };
  }
}

/** Display-only: reads the saved conflict window. Full fetch+compare is the top-bar control. */
export async function loadProductCatalogConflictAction(productId: string) {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    return { conflict: await getProductCatalogConflict(productId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load this product's conflict details." };
  }
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
    after(() => {
      revalidatePath("/admin/products");
    });
    return { definition, success: `Definition “${definition.name}” created in Shopify.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create the metafield definition." };
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

/** Resolves a bulk direction, a single product's direction, or a hand-picked manual field list into the concrete fields it would touch — nothing is written. See docs/wiki/catalog-conflict-resolution-ux.md dialogs 1-3. */
export async function previewCatalogConflictResolutionAction(scope: CatalogConflictApplyScope) {
  const session = await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };
  try {
    if (scope.kind === "PRODUCT" && !scope.productId.startsWith("shopify:")) {
      const checked = await runProductConflictCheck({ productId: scope.productId, requestedBy: session.username });
      if (checked.warning) return { error: checked.warning };
    }
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
    const pullResult = await applyShopifyProductToSynarava(product.shopifyProductId, undefined, force);
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

