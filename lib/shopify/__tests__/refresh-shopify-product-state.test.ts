import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PR1/PR2 contract: refreshShopifyProductState may only persist Shopify-side
 * copy (shopifySnapshot / shopifyUpdatedAt). Synarava commerce/translation
 * columns and syncStatus stay untouched — conflict SoT is SyncResult leaves.
 */

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
  findUniqueProduct: vi.fn(),
  updateProduct: vi.fn(),
  updateEvent: vi.fn(),
  findUniqueVariant: vi.fn(),
  updateVariant: vi.fn(),
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
    product: { findUnique: mocks.findUniqueProduct, update: mocks.updateProduct },
    productVariant: { findUnique: mocks.findUniqueVariant, update: mocks.updateVariant },
    productSyncEvent: { update: mocks.updateEvent },
  },
}));

import {
  pullShopifyInventory,
  refreshShopifyProductState,
} from "../product-sync";

function remoteProduct(overrides: {
  title?: string;
  price?: string;
  inventoryQuantity?: number;
} = {}) {
  const inventoryQuantity = overrides.inventoryQuantity ?? 3;
  return {
    id: "gid://shopify/Product/99",
    title: overrides.title ?? "Remote title",
    handle: "remote-handle",
    descriptionHtml: "<p>Remote</p>",
    vendor: "Synarava",
    productType: "Ring",
    tags: ["a"],
    status: "ACTIVE" as const,
    updatedAt: "2026-10-23T12:00:00Z",
    totalInventory: inventoryQuantity,
    category: null,
    seo: { title: null, description: null },
    media: { nodes: [] },
    options: [],
    collections: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    resourcePublicationsV2: {
      nodes: [{ isPublished: true, publishDate: "2026-01-01T00:00:00Z", publication: { id: "pub", name: "Online Store" } }],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    featuredMedia: null,
    variants: {
      nodes: [{
        id: "gid://shopify/ProductVariant/1",
        title: "Default",
        sku: "SKU-1",
        barcode: null,
        price: overrides.price ?? "100.00",
        compareAtPrice: null,
        inventoryPolicy: "DENY",
        inventoryQuantity,
        taxable: true,
        selectedOptions: [{ name: "Title", value: "Default" }],
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
  };
}

describe("refreshShopifyProductState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublishedStorefrontLocales.mockResolvedValue([
      { code: "en", shopifyLocale: "en", isDefault: true, name: "English" },
    ]);
    mocks.shopifyAdminRequest.mockResolvedValue({ product: remoteProduct({ title: "Shopify name", price: "55.00", inventoryQuantity: 9 }) });
    mocks.findUniqueProduct.mockResolvedValue({
      id: "local-1",
      name: "Local name",
      slug: "local-handle",
      vendor: "Synarava",
      productType: "Ring",
      priceCents: 10000,
      status: "ACTIVE",
      visibility: "PUBLIC",
      syncStatus: "SYNCED",
      shopifySnapshot: { title: "Old shopify" },
      extras: null,
      variants: [{
        id: "variant-1",
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        sku: "SKU-1",
        title: "Default",
        priceCents: 10000,
        taxable: true,
        stockOnHand: 2,
      }],
    });
    mocks.updateProduct.mockResolvedValue({ id: "local-1" });
  });

  it("writes shopifySnapshot without syncStatus or Synarava commerce columns", async () => {
    const result = await refreshShopifyProductState("99", "event-1");

    expect(result).toEqual({ productId: "local-1", status: "CONFLICT" });
    expect(mocks.updateProduct).toHaveBeenCalledTimes(1);
    const data = mocks.updateProduct.mock.calls[0][0].data;
    expect(data.shopifySnapshot).toBeDefined();
    expect(data.shopifySnapshot.title).toBe("Shopify name");
    expect(data).not.toHaveProperty("syncStatus");
    expect(data).not.toHaveProperty("syncError");
    expect(data).not.toHaveProperty("name");
    expect(data).not.toHaveProperty("priceCents");
    expect(data).not.toHaveProperty("status");
    expect(data).not.toHaveProperty("visibility");
    expect(data).not.toHaveProperty("workingSnapshot");
    expect(mocks.updateVariant).not.toHaveBeenCalled();
  });

  it("ignores Shopify-only products (no Synarava create)", async () => {
    mocks.findUniqueProduct.mockResolvedValue(null);
    const result = await refreshShopifyProductState("99", "event-1");
    expect(result).toEqual({ productId: null, status: "IGNORED" });
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.updateEvent).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { status: "IGNORED", completedAt: expect.any(Date) },
    });
  });
});

describe("pullShopifyInventory (refresh-only contract)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublishedStorefrontLocales.mockResolvedValue([
      { code: "en", shopifyLocale: "en", isDefault: true, name: "English" },
    ]);
    mocks.findUniqueVariant.mockResolvedValue({
      id: "variant-1",
      productId: "local-1",
      stockOnHand: 2,
    });
    mocks.findUniqueProduct.mockImplementation(async (args: { where: { id?: string; shopifyProductId?: string } }) => {
      if (args.where.id === "local-1") {
        return { shopifyProductId: "gid://shopify/Product/99" };
      }
      return {
        id: "local-1",
        name: "Local name",
        slug: "local-handle",
        vendor: "Synarava",
        productType: "Ring",
        priceCents: 10000,
        status: "ACTIVE",
        visibility: "PUBLIC",
        syncStatus: "SYNCED",
        shopifySnapshot: { title: "Local name" },
        extras: null,
        variants: [{
          id: "variant-1",
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          sku: "SKU-1",
          title: "Default",
          priceCents: 10000,
          taxable: true,
          stockOnHand: 2,
        }],
      };
    });
    mocks.shopifyAdminRequest.mockResolvedValue({
      product: remoteProduct({ title: "Local name", price: "100.00", inventoryQuantity: 9 }),
    });
    mocks.updateProduct.mockResolvedValue({ id: "local-1" });
  });

  it("does not write ProductVariant.stockOnHand", async () => {
    await pullShopifyInventory("gid://shopify/InventoryItem/1", "event-1");
    expect(mocks.updateVariant).not.toHaveBeenCalled();
    expect(mocks.updateProduct).toHaveBeenCalled();
    const data = mocks.updateProduct.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("name");
    expect(data.shopifySnapshot).toBeDefined();
  });
});
