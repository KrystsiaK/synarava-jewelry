import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    product: { updateMany: vi.fn() },
    productVariant: { updateMany: vi.fn() },
    collection: { updateMany: vi.fn() },
    siteSetting: { upsert: vi.fn() },
  };
  return {
    tx,
    siteSettingFindUnique: vi.fn(),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    siteSetting: { findUnique: mocks.siteSettingFindUnique, upsert: vi.fn() },
    $transaction: mocks.transaction,
  },
}));

import { classifyShopifyStoreBinding, rebindShopifyStore } from "@/lib/shopify/store-binding";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.siteSettingFindUnique.mockResolvedValue({ value: { shopDomain: "old-shop.myshopify.com" } });
  mocks.tx.product.updateMany.mockResolvedValue({ count: 2 });
  mocks.tx.productVariant.updateMany.mockResolvedValue({ count: 3 });
  mocks.tx.collection.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.siteSetting.upsert.mockResolvedValue({});
});

describe("Shopify store binding", () => {
  it("initializes an unbound installation", () => {
    expect(classifyShopifyStoreBinding(null, "New-Shop.myshopify.com/"))
      .toEqual({ status: "UNBOUND", currentShopDomain: "new-shop.myshopify.com" });
  });

  it("accepts the same canonical shop domain", () => {
    expect(classifyShopifyStoreBinding("new-shop.myshopify.com", "https://NEW-SHOP.myshopify.com"))
      .toEqual({ status: "MATCH", currentShopDomain: "new-shop.myshopify.com" });
  });

  it("requires an explicit rebind for a duplicated store", () => {
    expect(classifyShopifyStoreBinding("old-shop.myshopify.com", "new-shop.myshopify.com"))
      .toEqual({
        status: "MISMATCH",
        boundShopDomain: "old-shop.myshopify.com",
        currentShopDomain: "new-shop.myshopify.com",
      });
  });

  it("clears only store-scoped links when an administrator confirms a real store change", async () => {
    await expect(rebindShopifyStore("new-shop.myshopify.com", "new-shop.myshopify.com"))
      .resolves.toMatchObject({ shopDomain: "new-shop.myshopify.com", products: 2, variants: 3, collections: 1 });

    expect(mocks.tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ shopifyProductId: null, syncStatus: "UNLINKED" }),
    }));
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { shopifyVariantId: null, shopifyInventoryItemId: null },
    }));
    expect(mocks.tx.collection.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ shopifyCollectionId: null, shopifyManualSourceId: null }),
    }));
  });

  it("refuses to clear links when the catalog is already bound to the same store", async () => {
    mocks.siteSettingFindUnique.mockResolvedValue({ value: { shopDomain: "new-shop.myshopify.com" } });

    await expect(rebindShopifyStore("new-shop.myshopify.com", "new-shop.myshopify.com"))
      .rejects.toThrow("not currently linked to a different Shopify store");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
