import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  findMembership: vi.fn(),
  findProducts: vi.fn(),
  upsertMembership: vi.fn(),
  reorderShopifyCollectionProduct: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateStorefrontPath: vi.fn(),
  revalidateStorefrontTemplate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/admin-session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/shopify/collection-order", () => ({
  reorderShopifyCollectionProduct: mocks.reorderShopifyCollectionProduct,
}));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: mocks.revalidateStorefrontPath,
  revalidateStorefrontTemplate: mocks.revalidateStorefrontTemplate,
}));
vi.mock("@/lib/db", () => ({
  db: {
    productCollection: { findUnique: mocks.findMembership },
    product: { findMany: mocks.findProducts },
    $transaction: vi.fn(async (callback) => callback({
      productCollection: { upsert: mocks.upsertMembership },
    })),
  },
}));

import { reorderCollectionProductAction } from "../catalog-order";

describe("reorderCollectionProductAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMembership.mockResolvedValue({
      productId: "local-product-2",
      collectionId: "local-collection",
      product: { shopifyProductId: "gid://shopify/Product/2" },
      collection: { shopifyCollectionId: "gid://shopify/Collection/1" },
    });
    mocks.reorderShopifyCollectionProduct.mockResolvedValue([
      "gid://shopify/Product/2",
      "gid://shopify/Product/1",
    ]);
    mocks.findProducts.mockResolvedValue([
      { id: "local-product-1", shopifyProductId: "gid://shopify/Product/1" },
      { id: "local-product-2", shopifyProductId: "gid://shopify/Product/2" },
    ]);
  });

  it("persists Shopify's authoritative order locally", async () => {
    await expect(reorderCollectionProductAction({
      collectionId: "local-collection",
      productId: "local-product-2",
      newPosition: 0,
    })).resolves.toEqual({
      success: "Collection priority updated in Shopify.",
      orderedProductIds: ["local-product-2", "local-product-1"],
    });

    expect(mocks.upsertMembership).toHaveBeenNthCalledWith(1, {
      where: { productId_collectionId: { productId: "local-product-2", collectionId: "local-collection" } },
      create: { productId: "local-product-2", collectionId: "local-collection", sortOrder: 0 },
      update: { sortOrder: 0 },
    });
    expect(mocks.upsertMembership).toHaveBeenNthCalledWith(2, {
      where: { productId_collectionId: { productId: "local-product-1", collectionId: "local-collection" } },
      create: { productId: "local-product-1", collectionId: "local-collection", sortOrder: 1 },
      update: { sortOrder: 1 },
    });
  });

  it("rejects products or collections that are not linked to Shopify", async () => {
    mocks.findMembership.mockResolvedValue({
      productId: "local-product-2",
      collectionId: "local-collection",
      product: { shopifyProductId: null },
      collection: { shopifyCollectionId: null },
    });

    await expect(reorderCollectionProductAction({
      collectionId: "local-collection",
      productId: "local-product-2",
      newPosition: 0,
    })).resolves.toEqual({
      error: "Sync this product and collection with Shopify before changing priority.",
    });
    expect(mocks.reorderShopifyCollectionProduct).not.toHaveBeenCalled();
  });
});
