import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PR-A2: pushProductToShopify options gate translation side-effects.
 * Commerce-only overwrite must not call registerProductTranslation /
 * pushCustomMetafieldTranslations; explicit full Push still may.
 */

const mocks = vi.hoisted(() => ({
  registerProductTranslation: vi.fn(),
  fetchProductTranslation: vi.fn(),
  decideProductTranslationPull: vi.fn(),
  hasShopifySharedTranslationCopy: vi.fn(),
  pushCustomMetafieldTranslations: vi.fn(),
  fetchCustomMetafieldTranslations: vi.fn(),
  metafieldRefsFromNodes: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
  shopifyAdminRequest: vi.fn(),
  pushProductMetafields: vi.fn(),
  createSyncEvent: vi.fn(),
  updateSyncEvent: vi.fn(),
  findUniqueOrThrowProduct: vi.fn(),
  updateProduct: vi.fn(),
  findManyCollection: vi.fn(),
  findManyMediaAsset: vi.fn(),
  updateProductTranslation: vi.fn(),
  updateVariant: vi.fn(),
  getSkuServiceConfig: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    APP_URL: "https://example.com",
    S3_PUBLIC_URL: undefined,
    S3_ENDPOINT: undefined,
    SHOPIFY_LOCATION_ID: undefined,
    SHOPIFY_PUBLICATION_ID: "gid://shopify/Publication/1",
    SHOPIFY_STORE_DOMAIN: "test.myshopify.com",
  },
}));
vi.mock("@/lib/sku/config", () => ({
  getSkuServiceConfig: mocks.getSkuServiceConfig,
}));
vi.mock("@/lib/sku/client", () => ({ tryCreateSkuClient: vi.fn(() => null) }));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));
vi.mock("@/lib/shopify/translations", () => ({
  registerProductTranslation: mocks.registerProductTranslation,
  fetchProductTranslation: mocks.fetchProductTranslation,
  decideProductTranslationPull: mocks.decideProductTranslationPull,
  hasShopifySharedTranslationCopy: mocks.hasShopifySharedTranslationCopy,
}));
vi.mock("@/lib/shopify/product-metafield-translations", () => ({
  pushCustomMetafieldTranslations: mocks.pushCustomMetafieldTranslations,
  fetchCustomMetafieldTranslations: mocks.fetchCustomMetafieldTranslations,
  metafieldRefsFromNodes: mocks.metafieldRefsFromNodes,
}));
vi.mock("@/lib/shopify/product-metafields-push", () => ({
  pushProductMetafields: mocks.pushProductMetafields,
}));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyNumericId: (value: unknown) => String(value),
}));
vi.mock("@/lib/db", () => ({
  db: {
    productSyncEvent: {
      create: mocks.createSyncEvent,
      update: mocks.updateSyncEvent,
    },
    product: {
      findUniqueOrThrow: mocks.findUniqueOrThrowProduct,
      update: mocks.updateProduct,
    },
    collection: { findMany: mocks.findManyCollection },
    productVariant: { update: mocks.updateVariant, create: vi.fn() },
    productTranslation: { update: mocks.updateProductTranslation },
    productMedia: { deleteMany: vi.fn() },
    mediaAsset: { findMany: mocks.findManyMediaAsset, updateMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown) => ops),
  },
}));

import { pushProductToShopify } from "@/lib/shopify/product-sync";

function remoteProduct() {
  return {
    id: "gid://shopify/Product/1",
    title: "Ring",
    handle: "ring",
    descriptionHtml: "<p>Ring</p>",
    vendor: "Synarava",
    productType: "Ring",
    tags: [],
    status: "ACTIVE" as const,
    updatedAt: "2026-10-27T00:00:00Z",
    totalInventory: 1,
    category: null,
    seo: { title: null, description: null },
    media: { nodes: [] },
    options: [{ id: "opt", name: "Title", position: 1, values: ["Default Title"] }],
    collections: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    resourcePublicationsV2: {
      nodes: [{
        isPublished: true,
        publishDate: "2026-01-01T00:00:00Z",
        publication: { id: "gid://shopify/Publication/1", name: "Online Store" },
      }],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    featuredMedia: null,
    variants: {
      nodes: [{
        id: "gid://shopify/ProductVariant/1",
        title: "Default Title",
        sku: "SKU-1",
        barcode: null,
        price: "10.00",
        compareAtPrice: null,
        inventoryPolicy: "DENY" as const,
        inventoryQuantity: 1,
        taxable: true,
        selectedOptions: [{ name: "Title", value: "Default Title" }],
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

function localProduct() {
  const remote = remoteProduct();
  return {
    id: "product-1",
    name: "Ring",
    slug: "ring",
    description: "<p>Ring</p>",
    sku: "SKU-1",
    priceCents: 1000,
    compareAtCents: null,
    status: "ACTIVE",
    vendor: "Synarava",
    productType: "Ring",
    seoTitle: null,
    seoDescription: null,
    shopifyProductId: remote.id,
    shopifyHandle: "ring",
    shopifyCategoryId: null,
    shopifyCategoryName: null,
    imageUrl: null,
    primaryAssetId: null,
    primaryAsset: null,
    details: null,
    extras: null,
    shopifySnapshot: null,
    characteristics: [],
    variants: [{
      id: "var-1",
      sku: "SKU-1",
      priceCents: 1000,
      compareAtCents: null,
      costCents: null,
      taxable: true,
      stockOnHand: 1,
      shopifyVariantId: "gid://shopify/ProductVariant/1",
      shopifyInventoryItemId: "gid://shopify/InventoryItem/1",
    }],
    tags: [],
    collections: [],
    media: [],
    translations: [{
      id: "tr-pt",
      locale: "pt",
      title: "Anel",
      description: "<p>Anel</p>",
      seoTitle: null,
      seoDescription: null,
      reviewStatus: "REVIEWED",
      syncStatus: "PENDING",
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSkuServiceConfig.mockReturnValue({ configured: false });
  mocks.createSyncEvent.mockResolvedValue({ id: "event-1" });
  mocks.updateSyncEvent.mockResolvedValue({});
  mocks.updateProduct.mockResolvedValue({});
  mocks.updateVariant.mockResolvedValue({});
  mocks.updateProductTranslation.mockResolvedValue({});
  mocks.findManyCollection.mockResolvedValue([]);
  mocks.findManyMediaAsset.mockResolvedValue([]);
  mocks.findUniqueOrThrowProduct.mockResolvedValue(localProduct());
  mocks.getPublishedStorefrontLocales.mockResolvedValue([
    { code: "en", name: "English", isDefault: true, shopifyLocale: "en" },
    { code: "pt", name: "Portuguese", isDefault: false, shopifyLocale: "pt-PT" },
  ]);
  mocks.pushProductMetafields.mockResolvedValue([]);
  mocks.metafieldRefsFromNodes.mockReturnValue([]);
  mocks.pushCustomMetafieldTranslations.mockResolvedValue(undefined);
  mocks.fetchCustomMetafieldTranslations.mockResolvedValue([]);
  mocks.registerProductTranslation.mockResolvedValue(undefined);
  mocks.fetchProductTranslation.mockResolvedValue(null);
  mocks.hasShopifySharedTranslationCopy.mockReturnValue(false);
  mocks.decideProductTranslationPull.mockReturnValue("APPLY");

  const remote = remoteProduct();
  mocks.shopifyAdminRequest.mockImplementation(async (query: string) => {
    if (query.includes("query SynaravaProduct") || query.includes("product(id:")) {
      return { product: remote };
    }
    if (query.includes("productSet")) {
      return { productSet: { product: remote, userErrors: [] } };
    }
    if (query.includes("publishablePublish") || query.includes("publishableUnpublish")) {
      return { publishablePublish: { userErrors: [] }, publishableUnpublish: { userErrors: [] } };
    }
    if (query.includes("productVariantsBulkUpdate")) {
      return {
        productVariantsBulkUpdate: {
          productVariants: [remote.variants.nodes[0]],
          userErrors: [],
        },
      };
    }
    if (query.includes("inventoryActivate") || query.includes("inventorySetQuantities")) {
      return {
        inventoryActivate: { userErrors: [] },
        inventorySetQuantities: { userErrors: [] },
      };
    }
    if (query.includes("locations(")) {
      return { locations: { nodes: [] } };
    }
    return {};
  });
});

describe("pushProductToShopify translation options", () => {
  it("commerce-only overwrite does not register product or metafield translations", async () => {
    const result = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });

    if (!result.ok) throw new Error(result.error);
    expect(result.ok).toBe(true);
    expect(mocks.registerProductTranslation).not.toHaveBeenCalled();
    expect(mocks.pushCustomMetafieldTranslations).not.toHaveBeenCalled();
  });

  it("explicit full Push still pushes registered translations", async () => {
    const result = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: false,
      pushRegisteredTranslations: true,
    });

    if (!result.ok) throw new Error(result.error);
    expect(result.ok).toBe(true);
    expect(mocks.pushCustomMetafieldTranslations).toHaveBeenCalled();
    expect(mocks.registerProductTranslation).toHaveBeenCalled();
  });
});
