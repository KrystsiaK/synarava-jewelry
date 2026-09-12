"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { isShopifyConfigured } from "@/lib/shopify/config";
import {
  fetchShopifyShopIdentity,
  hasShopifyAdminConfig,
  testShopifyAdminConnection,
} from "@/lib/shopify/admin";
import {
  assertShopifyStoreBinding,
  ensureShopifyStoreBinding,
  rebindShopifyStore,
} from "@/lib/shopify/store-binding";
import {
  ensureProductWebhookSubscriptions,
  inspectProductSyncState,
  previewShopifyReconciliation,
  pullShopifyProduct,
  pushProductToShopify,
  reconcileShopifyProducts,
} from "@/lib/shopify/product-sync";
import { env } from "@/lib/env";
import { revalidateStorefront, writeAuditLog } from "./shared";
import { getSavedProductPayload } from "./products";

export type ShopifySyncSelection = {
  remoteProductIds: string[];
  localProductIds: string[];
};

async function assertConfiguredShopifyStore() {
  const shop = await fetchShopifyShopIdentity();
  await assertShopifyStoreBinding(shop.myshopifyDomain);
  return shop;
}

export async function reconcileProductsAction() {
  await requireAdminSession("/admin/products");
  if (!isShopifyConfigured()) return { error: "Shopify is not configured." };
  try {
    await assertConfiguredShopifyStore();
    if (env.NEXT_PUBLIC_APP_URL) {
      await ensureProductWebhookSubscriptions(env.NEXT_PUBLIC_APP_URL);
    }
    const result = await reconcileShopifyProducts();
    revalidateStorefront();
    revalidatePath("/admin/products");
    return { success: `Reconciliation complete: ${result.pulled} pulled, ${result.pushed} pushed, ${result.archived} archived, ${result.conflicts} conflicts, ${result.failed} failed.`, result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Reconciliation failed." };
  }
}

export async function testShopifyConnectionAction() {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) {
    const missingVariables = [
      !env.SHOPIFY_STORE_DOMAIN ? "SHOPIFY_STORE_DOMAIN" : null,
      !env.SHOPIFY_CLIENT_ID && !env.SHOPIFY_ADMIN_ACCESS_TOKEN ? "SHOPIFY_CLIENT_ID" : null,
      !env.SHOPIFY_CLIENT_SECRET && !env.SHOPIFY_ADMIN_ACCESS_TOKEN ? "SHOPIFY_CLIENT_SECRET" : null,
    ].filter((value): value is string => Boolean(value));
    return {
      error: `Shopify Admin API is not configured. Missing: ${missingVariables.join(", ")}. Restart the dev server after changing environment variables.`,
    };
  }

  try {
    const connection = await testShopifyAdminConnection();
    if (connection.missingScopes.length > 0) {
      return {
        error: `Connected to ${connection.shopName}, but required scopes are missing: ${connection.missingScopes.join(", ")}.`,
        connection,
      };
    }
    if (!connection.portuguesePublished) {
      return {
        error: `Connected to ${connection.shopName}, but Portuguese (Portugal, pt-PT) is not enabled and published in Shopify Markets.`,
        connection,
      };
    }

    const binding = await ensureShopifyStoreBinding(connection.shopDomain);
    if (binding.status === "MISMATCH") {
      return {
        error: `This Synarava catalog is linked to ${binding.boundShopDomain}, while these credentials point to ${binding.currentShopDomain}. Rebind explicitly before syncing.`,
        connection,
        storeMismatch: {
          boundShopDomain: binding.boundShopDomain,
          currentShopDomain: binding.currentShopDomain,
        },
      };
    }

    return {
      success: `Connected to ${connection.shopName}: ${connection.productCount} Shopify products, ${connection.locations.length} locations, ${connection.publications.length} publications.`,
      connection,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Shopify connection test failed." };
  }
}

export async function previewShopifyReconciliationAction() {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) {
    return { error: "Shopify Admin API credentials are not configured." };
  }

  try {
    await assertConfiguredShopifyStore();
    const preview = await previewShopifyReconciliation();
    return {
      success: `Preview ready: ${preview.remote.length} Shopify products read, ${preview.pushToShopify.length} local products would be pushed, ${preview.archiveLocal.length} local products would be archived.`,
      preview,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Shopify reconciliation preview failed." };
  }
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
        ? "Commerce changes pushed to Shopify; Portuguese translation needs attention."
        : "Commerce and Portuguese translation pushed to Shopify.",
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
    revalidateStorefront();
    revalidatePath("/admin/products");
    const savedProduct = await getSavedProductPayload(productId);
    return {
      success: pullResult.translationStatus === "CONFLICT"
        ? "Shopify commerce data pulled. Portuguese has edits on both sides; choose Pull or Push to resolve it."
        : pullResult.translationStatus === "UNAVAILABLE"
          ? "Shopify commerce data pulled, but Portuguese could not be read. Check read_translations access."
          : "Latest Shopify commerce and Portuguese translation data pulled. Synarava-only editorial fields were preserved.",
      translationWarning: pullResult.translationStatus === "CONFLICT" || pullResult.translationStatus === "UNAVAILABLE",
      product: savedProduct,
      inspection: await inspectProductSyncState(productId),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Shopify pull failed." };
  }
}

export async function syncShopifySelectionAction(selection: ShopifySyncSelection) {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) {
    return { error: "Shopify Admin API credentials are not configured." };
  }

  const remoteProductIds = Array.from(new Set(selection.remoteProductIds)).slice(0, 100);
  const localProductIds = Array.from(new Set(selection.localProductIds)).slice(0, 100);
  if (remoteProductIds.length === 0 && localProductIds.length === 0) {
    return { error: "Select at least one product to synchronize." };
  }

  try {
    await assertConfiguredShopifyStore();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Shopify store binding check failed." };
  }

  let pulled = 0;
  let pushed = 0;
  const failures: string[] = [];
  const changedProductIds = new Set<string>();

  for (const shopifyProductId of remoteProductIds) {
    try {
      const linkedLocal = await db.product.findUnique({
        where: { shopifyProductId },
        select: { id: true },
      });
      if (linkedLocal) {
        const inspection = await inspectProductSyncState(linkedLocal.id);
        if (inspection.state === "LOCAL_CHANGES" || inspection.state === "CONFLICT") {
          failures.push(`${shopifyProductId}: local commerce changes need an explicit conflict decision`);
          continue;
        }
      }
      const result = await pullShopifyProduct(shopifyProductId);
      if (result.status === "CONFLICT") failures.push(`${shopifyProductId}: commerce conflict needs an explicit decision`);
      else if (result.status === "LOCAL_CHANGES") failures.push(`${shopifyProductId}: saved local commerce changes must be pushed or resolved first`);
      else if (result.translationStatus === "CONFLICT") failures.push(`${shopifyProductId}: Portuguese changed on both sides; choose Pull or Push`);
      else if (result.translationStatus === "UNAVAILABLE") failures.push(`${shopifyProductId}: Portuguese could not be read from Shopify`);
      else {
        pulled += 1;
        changedProductIds.add(result.productId);
      }
    } catch (error) {
      failures.push(`${shopifyProductId}: ${error instanceof Error ? error.message : "pull failed"}`);
    }
  }

  for (const productId of localProductIds) {
    try {
      const inspection = await inspectProductSyncState(productId);
      if (inspection.state !== "UNLINKED" && inspection.state !== "LOCAL_CHANGES") {
        failures.push(`${productId}: Shopify state changed; refresh the preview and resolve it explicitly`);
        continue;
      }
      const result = await pushProductToShopify(productId);
      if (result.ok) {
        pushed += 1;
        changedProductIds.add(productId);
      }
      else failures.push(`${productId}: ${result.error}`);
    } catch (error) {
      failures.push(`${productId}: ${error instanceof Error ? error.message : "push failed"}`);
    }
  }

  revalidateStorefront();
  revalidatePath("/admin/products");
  const preview = await previewShopifyReconciliation();
  const products = await Promise.all(Array.from(changedProductIds).map((id) => getSavedProductPayload(id)));
  const summary = `${pulled} imported, ${pushed} pushed${failures.length ? `, ${failures.length} failed` : ""}.`;

  return {
    success: failures.length < remoteProductIds.length + localProductIds.length
      ? `Synchronization complete: ${summary}`
      : undefined,
    error: failures.length ? `Some products could not be synchronized: ${failures.join("; ")}` : undefined,
    preview,
    products,
    result: { pulled, pushed, failed: failures.length },
  };
}

export async function rebindShopifyStoreAction(expectedShopDomain: string) {
  await requireAdminSession("/admin/products");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };

  try {
    const connection = await testShopifyAdminConnection();
    if (connection.missingScopes.length > 0) {
      return { error: `The new Shopify store is missing scopes: ${connection.missingScopes.join(", ")}.` };
    }
    if (!connection.portuguesePublished) {
      return { error: "Enable and publish Portuguese (Portugal, pt-PT) in the new Shopify store before rebinding." };
    }
    const result = await rebindShopifyStore(expectedShopDomain, connection.shopDomain);
    revalidatePath("/admin/products");
    return {
      success: `Catalog is ready to link with ${result.shopDomain}. Run Preview sync to match cloned products by SKU or handle before applying changes.`,
      result,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Shopify store rebind failed." };
  }
}

export async function archiveMissingShopifyProductsAction(productIds: string[]) {
  await requireAdminSession("/admin/products");
  const selectedIds = Array.from(new Set(productIds)).slice(0, 100);
  if (selectedIds.length === 0) return { error: "Select at least one product to archive." };

  try {
    const beforePreview = await previewShopifyReconciliation();
    const confirmedMissingIds = new Set(beforePreview.archiveLocal.map((item) => item.productId));
    const safeIds = selectedIds.filter((id) => confirmedMissingIds.has(id));
    if (safeIds.length !== selectedIds.length) {
      return { error: "The catalog changed after preview. Run Preview sync again before archiving." };
    }

    for (const productId of safeIds) {
      const before = await db.product.findUnique({ where: { id: productId } });
      if (!before) continue;
      const after = await db.product.update({
        where: { id: productId },
        data: {
          status: "ARCHIVED",
          visibility: "PRIVATE",
          syncStatus: "UNLINKED",
          syncError: "Product no longer exists in Shopify.",
        },
      });
      await writeAuditLog({
        action: "SHOPIFY_MISSING_ARCHIVE",
        entityType: "PRODUCT",
        entityId: productId,
        before,
        after,
      });
    }

    revalidateStorefront();
    revalidatePath("/admin/products");
    const preview = await previewShopifyReconciliation();
    const products = await Promise.all(safeIds.map((id) => getSavedProductPayload(id)));
    return { success: `${safeIds.length} missing product${safeIds.length === 1 ? "" : "s"} archived locally.`, preview, products };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Local archive failed." };
  }
}
