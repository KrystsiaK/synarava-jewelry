import "server-only";

import { db } from "@/lib/db";
import { ShopifyAdminError } from "@/lib/shopify/admin";

const SHOPIFY_STORE_BINDING_KEY = "shopify.store_binding";

function normalizeShopDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function classifyShopifyStoreBinding(boundShopDomain: string | null, currentShopDomain: string) {
  const current = normalizeShopDomain(currentShopDomain);
  if (!boundShopDomain) return { status: "UNBOUND" as const, currentShopDomain: current };
  const bound = normalizeShopDomain(boundShopDomain);
  if (bound === current) return { status: "MATCH" as const, currentShopDomain: current };
  return {
    status: "MISMATCH" as const,
    boundShopDomain: bound,
    currentShopDomain: current,
  };
}

export async function getShopifyStoreBinding() {
  const setting = await db.siteSetting.findUnique({ where: { key: SHOPIFY_STORE_BINDING_KEY } });
  const value = setting?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const shopDomain = "shopDomain" in value && typeof value.shopDomain === "string"
    ? value.shopDomain
    : null;
  return shopDomain ? normalizeShopDomain(shopDomain) : null;
}

export async function ensureShopifyStoreBinding(currentShopDomain: string) {
  const classification = classifyShopifyStoreBinding(await getShopifyStoreBinding(), currentShopDomain);
  if (classification.status === "UNBOUND") {
    await db.siteSetting.upsert({
      where: { key: SHOPIFY_STORE_BINDING_KEY },
      update: { value: { shopDomain: classification.currentShopDomain } },
      create: { key: SHOPIFY_STORE_BINDING_KEY, value: { shopDomain: classification.currentShopDomain } },
    });
  }
  return classification;
}

export async function assertShopifyStoreBinding(currentShopDomain: string) {
  const classification = classifyShopifyStoreBinding(await getShopifyStoreBinding(), currentShopDomain);
  if (classification.status === "UNBOUND") {
    throw new ShopifyAdminError("Test the Shopify connection once to bind this catalog before syncing.");
  }
  if (classification.status === "MISMATCH") {
    throw new ShopifyAdminError(
      `This catalog is linked to ${classification.boundShopDomain}, but the current credentials belong to ${classification.currentShopDomain}. Test the connection and explicitly rebind before syncing.`,
    );
  }
  return classification;
}

export async function rebindShopifyStore(expectedCurrentShopDomain: string, actualCurrentShopDomain: string) {
  const expected = normalizeShopDomain(expectedCurrentShopDomain);
  const actual = normalizeShopDomain(actualCurrentShopDomain);
  if (expected !== actual) {
    throw new ShopifyAdminError("The configured Shopify store changed after confirmation. Test the connection again.");
  }
  const classification = classifyShopifyStoreBinding(await getShopifyStoreBinding(), actual);
  if (classification.status !== "MISMATCH") {
    throw new ShopifyAdminError("This catalog is not currently linked to a different Shopify store.");
  }

  const [products, variants, collections] = await db.$transaction(async (tx) => {
    const productResult = await tx.product.updateMany({
      where: { shopifyProductId: { not: null } },
      data: {
        shopifyProductId: null,
        shopifyHandle: null,
        shopifyUpdatedAt: null,
        lastSyncedAt: null,
        syncStatus: "UNLINKED",
        syncError: `Ready to link with ${actual}.`,
      },
    });
    const variantResult = await tx.productVariant.updateMany({
      where: {
        OR: [
          { shopifyVariantId: { not: null } },
          { shopifyInventoryItemId: { not: null } },
        ],
      },
      data: { shopifyVariantId: null, shopifyInventoryItemId: null },
    });
    const collectionResult = await tx.collection.updateMany({
      where: {
        OR: [
          { shopifyCollectionId: { not: null } },
          { shopifyManualSourceId: { not: null } },
        ],
      },
      data: {
        shopifyCollectionId: null,
        shopifyManualSourceId: null,
        shopifyHandle: null,
        lastSyncedAt: null,
      },
    });
    await tx.siteSetting.upsert({
      where: { key: SHOPIFY_STORE_BINDING_KEY },
      update: { value: { shopDomain: actual, reboundAt: new Date().toISOString() } },
      create: { key: SHOPIFY_STORE_BINDING_KEY, value: { shopDomain: actual, reboundAt: new Date().toISOString() } },
    });
    return [productResult.count, variantResult.count, collectionResult.count] as const;
  });

  return { shopDomain: actual, products, variants, collections };
}
