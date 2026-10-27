import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PR1: inventory webhook path must not write Synarava stockOnHand.
 * Full refresh behavior is covered in refresh-shopify-product-state.test.ts;
 * this file locks the ignore path and the no-variant-update contract.
 */

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
  findUniqueVariant: vi.fn(),
  findUniqueProduct: vi.fn(),
  updateVariant: vi.fn(),
  updateProduct: vi.fn(),
  updateEvent: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { SHOPIFY_LOCATION_ID: undefined } }));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyNumericId: (value: unknown) =>
    String(value).startsWith("gid://") ? String(value) : `gid://shopify/Product/${value}`,
}));
vi.mock("@/lib/db", () => ({
  db: {
    productVariant: { findUnique: mocks.findUniqueVariant, update: mocks.updateVariant },
    product: { findUnique: mocks.findUniqueProduct, update: mocks.updateProduct },
    productSyncEvent: { update: mocks.updateEvent },
  },
}));

import { pullShopifyInventory } from "../product-sync";

describe("pullShopifyInventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublishedStorefrontLocales.mockResolvedValue([
      { code: "en", shopifyLocale: "en", isDefault: true, name: "English" },
    ]);
  });

  it("ignores unknown inventory items without writing variants (REV-04 lineage)", async () => {
    mocks.findUniqueVariant.mockResolvedValue(null);
    await expect(pullShopifyInventory("gid://shopify/InventoryItem/1", "event-1")).resolves.toEqual({
      ignored: true,
    });
    expect(mocks.updateVariant).not.toHaveBeenCalled();
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.updateEvent).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { status: "IGNORED", completedAt: expect.any(Date) },
    });
  });

  it("never writes stockOnHand when refreshing a linked variant", async () => {
    mocks.findUniqueVariant.mockResolvedValue({ id: "variant-1", productId: "product-1" });
    mocks.findUniqueProduct.mockImplementation(async (args: { where: Record<string, string> }) => {
      if (args.where.id === "product-1") {
        return { shopifyProductId: "gid://shopify/Product/1" };
      }
      return {
        id: "product-1",
        name: "Local",
        slug: "local",
        vendor: null,
        productType: null,
        priceCents: 1000,
        syncStatus: "SYNCED",
        status: "ACTIVE",
        extras: null,
        variants: [{
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          sku: "SKU",
          title: "Default",
          priceCents: 1000,
          taxable: true,
          stockOnHand: 2,
        }],
      };
    });
    mocks.shopifyAdminRequest.mockResolvedValue({
      product: {
        id: "gid://shopify/Product/1",
        title: "Local",
        handle: "local",
        descriptionHtml: "",
        vendor: "",
        productType: "",
        tags: [],
        status: "ACTIVE",
        updatedAt: "2026-10-23T12:00:00Z",
        totalInventory: 9,
        category: null,
        seo: { title: null, description: null },
        media: { nodes: [] },
        options: [],
        collections: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        resourcePublicationsV2: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
        featuredMedia: null,
        variants: {
          nodes: [{
            id: "gid://shopify/ProductVariant/1",
            title: "Default",
            sku: "SKU",
            barcode: null,
            price: "10.00",
            compareAtPrice: null,
            inventoryPolicy: "DENY",
            inventoryQuantity: 9,
            taxable: true,
            selectedOptions: [],
            inventoryItem: {
              id: "gid://shopify/InventoryItem/1",
              requiresShipping: true,
              tracked: false,
              countryCodeOfOrigin: null,
              harmonizedSystemCode: null,
              unitCost: null,
              measurement: null,
            },
          }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
        metafields: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
      },
    });
    mocks.updateProduct.mockResolvedValue({ id: "product-1" });

    await pullShopifyInventory("gid://shopify/InventoryItem/1", "event-1");

    expect(mocks.updateVariant).not.toHaveBeenCalled();
    expect(mocks.updateProduct).toHaveBeenCalled();
    const data = mocks.updateProduct.mock.calls[0][0].data;
    expect(data.shopifySnapshot).toBeDefined();
    expect(data).not.toHaveProperty("name");
  });
});
