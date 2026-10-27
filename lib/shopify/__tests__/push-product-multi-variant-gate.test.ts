import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * STEP 9: Linked Keep ours / Push only writes remote.variants.nodes[0].
 * Block multi-variant linked push; Create (unlinked) still allowed.
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
  createVariant: vi.fn(),
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
    productVariant: { update: mocks.updateVariant, create: mocks.createVariant },
    productTranslation: { update: mocks.updateProductTranslation },
    productMedia: { deleteMany: vi.fn() },
    mediaAsset: { findMany: mocks.findManyMediaAsset, updateMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown) => ops),
  },
}));

import { MULTI_VARIANT_PUSH_BLOCKED_REASON } from "@/lib/shopify/catalog-conflict-policy";
import { pushProductToShopify } from "@/lib/shopify/product-sync";

function variantNode(id: string, sku: string) {
  return {
    id,
    title: sku,
    sku,
    barcode: null,
    price: "10.00",
    compareAtPrice: null,
    inventoryPolicy: "DENY" as const,
    inventoryQuantity: 1,
    taxable: true,
    selectedOptions: [{ name: "Title", value: sku }],
    inventoryItem: {
      id: id.replace("ProductVariant", "InventoryItem"),
      requiresShipping: true,
      tracked: false,
      countryCodeOfOrigin: null,
      harmonizedSystemCode: null,
      unitCost: null,
      measurement: null,
    },
  };
}

function remoteProduct(variantCount: number) {
  const nodes = Array.from({ length: variantCount }, (_, i) =>
    variantNode(`gid://shopify/ProductVariant/${i + 1}`, `SKU-${i + 1}`),
  );
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
    totalInventory: variantCount,
    category: null,
    seo: { title: null, description: null },
    media: { nodes: [] },
    options: [{ id: "opt", name: "Title", position: 1, values: nodes.map((n) => n.title) }],
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
    variants: { nodes, pageInfo: { hasNextPage: false, endCursor: null } },
    metafields: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  };
}

function localProduct(opts: {
  shopifyProductId: string | null;
  localVariantCount: number;
}) {
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
    shopifyProductId: opts.shopifyProductId,
    shopifyHandle: opts.shopifyProductId ? "ring" : null,
    shopifyCategoryId: null,
    shopifyCategoryName: null,
    imageUrl: null,
    primaryAssetId: null,
    primaryAsset: null,
    details: null,
    extras: null,
    shopifySnapshot: null,
    characteristics: [],
    variants: Array.from({ length: opts.localVariantCount }, (_, i) => ({
      id: `var-${i + 1}`,
      sku: `SKU-${i + 1}`,
      priceCents: 1000,
      compareAtCents: null,
      costCents: null,
      taxable: true,
      stockOnHand: 1,
      shopifyVariantId: opts.shopifyProductId ? `gid://shopify/ProductVariant/${i + 1}` : null,
      shopifyInventoryItemId: opts.shopifyProductId ? `gid://shopify/InventoryItem/${i + 1}` : null,
    })),
    tags: [],
    collections: [],
    media: [],
    translations: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSkuServiceConfig.mockReturnValue({ configured: false });
  mocks.createSyncEvent.mockResolvedValue({ id: "event-1" });
  mocks.updateSyncEvent.mockResolvedValue({});
  mocks.updateProduct.mockResolvedValue({});
  mocks.updateVariant.mockResolvedValue({});
  mocks.createVariant.mockResolvedValue({});
  mocks.updateProductTranslation.mockResolvedValue({});
  mocks.findManyCollection.mockResolvedValue([]);
  mocks.findManyMediaAsset.mockResolvedValue([]);
  mocks.getPublishedStorefrontLocales.mockResolvedValue([
    { code: "en", name: "English", isDefault: true, shopifyLocale: "en" },
  ]);
  mocks.pushProductMetafields.mockResolvedValue([]);
  mocks.metafieldRefsFromNodes.mockReturnValue([]);
  mocks.pushCustomMetafieldTranslations.mockResolvedValue(undefined);
  mocks.fetchCustomMetafieldTranslations.mockResolvedValue([]);
  mocks.registerProductTranslation.mockResolvedValue(undefined);
  mocks.fetchProductTranslation.mockResolvedValue(null);
  mocks.hasShopifySharedTranslationCopy.mockReturnValue(false);
  mocks.decideProductTranslationPull.mockReturnValue("APPLY");
});

describe("pushProductToShopify multi-variant gate", () => {
  it("blocks linked Keep ours / Push when Shopify has more than one variant", async () => {
    const remote = remoteProduct(2);
    mocks.findUniqueOrThrowProduct.mockResolvedValue(
      localProduct({ shopifyProductId: remote.id, localVariantCount: 1 }),
    );
    mocks.shopifyAdminRequest.mockImplementation(async (query: string) => {
      if (query.includes("query SynaravaProduct") || query.includes("product(id:")) {
        return { product: remote };
      }
      throw new Error(`unexpected query: ${query.slice(0, 80)}`);
    });

    const result = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });

    expect(result).toEqual({
      ok: false,
      error: MULTI_VARIANT_PUSH_BLOCKED_REASON,
    });
    expect(mocks.shopifyAdminRequest.mock.calls.every(
      ([query]) => typeof query === "string" && !query.includes("productSet"),
    )).toBe(true);
  });

  it("blocks linked Push when local has more than one variant", async () => {
    const remote = remoteProduct(1);
    mocks.findUniqueOrThrowProduct.mockResolvedValue(
      localProduct({ shopifyProductId: remote.id, localVariantCount: 2 }),
    );
    mocks.shopifyAdminRequest.mockImplementation(async (query: string) => {
      if (query.includes("query SynaravaProduct") || query.includes("product(id:")) {
        return { product: remote };
      }
      throw new Error(`unexpected query: ${query.slice(0, 80)}`);
    });

    const result = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(MULTI_VARIANT_PUSH_BLOCKED_REASON);
  });
});
