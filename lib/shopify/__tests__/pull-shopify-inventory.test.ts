import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
  findUniqueVariant: vi.fn(),
  updateVariant: vi.fn(),
  updateProduct: vi.fn(),
  updateEvent: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { SHOPIFY_LOCATION_ID: undefined } }));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyNumericId: (value: unknown) => String(value),
}));
vi.mock("@/lib/db", () => ({
  db: {
    productVariant: { findUnique: mocks.findUniqueVariant, update: mocks.updateVariant },
    product: { update: mocks.updateProduct },
    productSyncEvent: { update: mocks.updateEvent },
  },
}));

import { pullShopifyInventory } from "../product-sync";

describe("pullShopifyInventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shopifyAdminRequest.mockResolvedValue({
      inventoryItem: {
        inventoryLevels: { nodes: [{ location: { id: "loc-1" }, quantities: [{ name: "available", quantity: 7 }] }] },
      },
    });
    mocks.findUniqueVariant.mockResolvedValue({ id: "variant-1", productId: "product-1" });
  });

  it("updates only the variant's stock, leaving the product's sync status untouched (REV-04)", async () => {
    await pullShopifyInventory("gid://shopify/InventoryItem/1", "event-1");

    expect(mocks.updateVariant).toHaveBeenCalledWith({ where: { id: "variant-1" }, data: { stockOnHand: 7 } });
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.updateEvent).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { productId: "product-1", status: "SUCCEEDED", completedAt: expect.any(Date) },
    });
  });
});
