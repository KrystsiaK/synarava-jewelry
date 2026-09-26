import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { shopifyAdminRequest } from "@/lib/shopify/admin";
import { pullShopifyProduct, pushProductToShopify } from "@/lib/shopify/product-sync";
import { ensureTranslationBinding } from "@/lib/shopify/translation-sync";
import {
  classifyCatalogPresence,
  type CatalogPresenceDifference,
  type LocalCatalogIdentity,
  type RemoteCatalogIdentity,
} from "@/lib/shopify/catalog-presence";

type ShopifyPresenceProduct = {
  id: string;
  title: string;
  handle: string;
  updatedAt: string;
  variants: { nodes: Array<{ sku: string | null }> };
};

function isPresenceDifference(value: unknown): value is CatalogPresenceDifference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<CatalogPresenceDifference>;
  return typeof item.id === "string"
    && (item.kind === "SHOPIFY_ONLY" || item.kind === "SYNARAVA_ONLY")
    && (item.localProductId === null || typeof item.localProductId === "string")
    && (item.shopifyProductId === null || typeof item.shopifyProductId === "string")
    && typeof item.name === "string"
    && typeof item.handle === "string"
    && typeof item.sku === "string"
    && typeof item.localFingerprint === "string"
    && typeof item.shopifyFingerprint === "string"
    && typeof item.remoteMissing === "boolean"
    && (item.matchReason === null || item.matchReason === "SKU" || item.matchReason === "HANDLE")
    && (item.localIdentity === null || (
      typeof item.localIdentity === "object"
      && typeof item.localIdentity.name === "string"
      && typeof item.localIdentity.handle === "string"
      && typeof item.localIdentity.sku === "string"
    ))
    && (item.shopifyIdentity === null || (
      typeof item.shopifyIdentity === "object"
      && typeof item.shopifyIdentity.name === "string"
      && typeof item.shopifyIdentity.handle === "string"
      && typeof item.shopifyIdentity.sku === "string"
    ));
}

function parsePresenceSnapshot(value: unknown): CatalogPresenceDifference[] {
  return Array.isArray(value) ? value.filter(isPresenceDifference) : [];
}

async function listRemoteCatalogIdentities(): Promise<RemoteCatalogIdentity[]> {
  const products: RemoteCatalogIdentity[] = [];
  let cursor: string | null = null;
  do {
    const data: {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: ShopifyPresenceProduct[];
      };
    } = await shopifyAdminRequest(
      `query SynaravaCatalogPresence($after: String) {
        products(first: 100, after: $after, sortKey: ID) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id title handle updatedAt
            variants(first: 1) { nodes { sku } }
          }
        }
      }`,
      { after: cursor },
    );
    products.push(...data.products.nodes.map((product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      sku: product.variants.nodes[0]?.sku?.trim() || `SHOPIFY-${product.id.split("/").pop()}`,
      updatedAt: product.updatedAt,
    })));
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);
  return products;
}

export async function scanAndSaveCatalogPresence(runId: string | null): Promise<CatalogPresenceDifference[]> {
  const [localRows, remoteProducts] = await Promise.all([
    db.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        shopifyProductId: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    listRemoteCatalogIdentities(),
  ]);
  const localProducts: LocalCatalogIdentity[] = localRows.map((product) => ({
    ...product,
    updatedAt: product.updatedAt.toISOString(),
  }));
  const differences = classifyCatalogPresence(localProducts, remoteProducts);
  const checkedAt = new Date();
  const serialized = differences as unknown as Prisma.InputJsonValue;
  await db.shopifyCatalogPresenceSnapshot.upsert({
    where: { id: "catalog" },
    create: { id: "catalog", runId, differences: serialized, checkedAt },
    update: { runId, differences: serialized, checkedAt },
  });
  return differences;
}

export async function getLatestCatalogPresenceDifferences(): Promise<CatalogPresenceDifference[]> {
  const snapshot = await db.shopifyCatalogPresenceSnapshot.findUnique({ where: { id: "catalog" } });
  return parsePresenceSnapshot(snapshot?.differences);
}

export async function removeCatalogPresenceDifference(conflictId: string): Promise<void> {
  const snapshot = await db.shopifyCatalogPresenceSnapshot.findUnique({ where: { id: "catalog" } });
  if (!snapshot) return;
  const next = parsePresenceSnapshot(snapshot.differences).filter((item) => item.id !== conflictId);
  await db.shopifyCatalogPresenceSnapshot.update({
    where: { id: "catalog" },
    data: { differences: next as unknown as Prisma.InputJsonValue },
  });
}

export type CatalogPresenceApplyResult =
  | { ok: true; localProductId: string; message: string }
  | { ok: false; reason: "STALE" | "UNSUPPORTED" | "WRITE_FAILED"; message: string };

/** Applies an already re-scanned one-sided catalog difference. */
export async function applyCatalogPresenceDifference({
  difference,
  direction,
}: {
  difference: CatalogPresenceDifference;
  direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
}): Promise<CatalogPresenceApplyResult> {
  const expectedDirection = difference.kind === "SHOPIFY_ONLY" ? "SHOPIFY_TO_SYNARAVA" : "SYNARAVA_TO_SHOPIFY";
  if (direction !== expectedDirection) {
    return {
      ok: false,
      reason: "UNSUPPORTED",
      message: difference.kind === "SHOPIFY_ONLY"
        ? "This product only exists in Shopify, so it must be pulled first."
        : "This product only exists in Synarava, so it must be pushed first.",
    };
  }

  try {
    if (difference.kind === "SHOPIFY_ONLY") {
      if (!difference.shopifyProductId) {
        return { ok: false, reason: "STALE", message: "The Shopify product is no longer available." };
      }
      const pulled = await pullShopifyProduct(difference.shopifyProductId, undefined, true);
      await ensureTranslationBinding({
        resourceType: "PRODUCT",
        entityId: pulled.productId,
        shopifyResourceId: difference.shopifyProductId,
      });
      await removeCatalogPresenceDifference(difference.id);
      return { ok: true, localProductId: pulled.productId, message: "Product pulled from Shopify." };
    }

    if (!difference.localProductId) {
      return { ok: false, reason: "STALE", message: "The Synarava product is no longer available." };
    }

    // A previously linked product whose Shopify record was deleted must be
    // recreated, not sent through productSet with the dead remote ID.
    if (difference.remoteMissing && difference.shopifyProductId) {
      await db.$transaction([
        db.shopifyTranslationBinding.deleteMany({
          where: { resourceType: "PRODUCT", entityId: difference.localProductId },
        }),
        db.productVariant.updateMany({
          where: { productId: difference.localProductId },
          data: { shopifyVariantId: null, shopifyInventoryItemId: null },
        }),
        db.product.update({
          where: { id: difference.localProductId },
          data: {
            shopifyProductId: null,
            shopifyHandle: null,
            shopifyUpdatedAt: null,
            lastSyncedAt: null,
            syncStatus: "UNLINKED",
            syncError: null,
          },
        }),
      ]);
    }

    const pushed = await pushProductToShopify(difference.localProductId, true);
    if (!pushed.ok) return { ok: false, reason: "WRITE_FAILED", message: pushed.error };
    await ensureTranslationBinding({
      resourceType: "PRODUCT",
      entityId: difference.localProductId,
      shopifyResourceId: pushed.shopifyProductId,
    });
    await removeCatalogPresenceDifference(difference.id);
    return { ok: true, localProductId: difference.localProductId, message: "Product pushed to Shopify." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The product could not be synchronized.";
    const target = difference.shopifyProductId ?? difference.localProductId ?? difference.id;
    return {
      ok: false,
      reason: "WRITE_FAILED",
      message: `Presence ${difference.kind} apply failed for ${target}: ${detail}`,
    };
  }
}
