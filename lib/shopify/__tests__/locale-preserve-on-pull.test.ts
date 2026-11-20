/**
 * ADR-0008 / ADR-0009: Shopify pull / refresh must never silently overwrite
 * Synarava locale copy (ProductTranslation + extras.metafieldTranslations).
 * Old Shopify observation → CONFLICT / shopifySnapshot only — not local wipe.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
  fetchCustomMetafieldTranslations: vi.fn(),
  metafieldRefsFromNodes: vi.fn(),
  fetchProductTranslation: vi.fn(),
  findUniqueProduct: vi.fn(),
  upsertProduct: vi.fn(),
  updateProduct: vi.fn(),
  findUniqueTranslation: vi.fn(),
  updateTranslation: vi.fn(),
  findUniqueVariant: vi.fn(),
  upsertVariant: vi.fn(),
  findManyCharacteristic: vi.fn(),
  upsertCharacteristic: vi.fn(),
  updateEvent: vi.fn(),
  productTagDeleteMany: vi.fn(),
  productTagCreate: vi.fn(),
  productCollectionDeleteMany: vi.fn(),
  productCollectionCreate: vi.fn(),
  releaseReadyLocalProductMedia: vi.fn(),
  deleteUnreferencedArchivedProductAssets: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { SHOPIFY_LOCATION_ID: undefined, SHOPIFY_PUBLICATION_ID: undefined },
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyNumericId: (value: unknown) =>
    String(value).startsWith("gid://") ? String(value) : `gid://shopify/Product/${value}`,
}));
vi.mock("@/lib/shopify/product-metafield-translations", () => ({
  fetchCustomMetafieldTranslations: mocks.fetchCustomMetafieldTranslations,
  metafieldRefsFromNodes: mocks.metafieldRefsFromNodes,
  pushCustomMetafieldTranslations: vi.fn(),
}));
vi.mock("@/lib/shopify/translations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shopify/translations")>();
  return {
    ...actual,
    fetchProductTranslation: mocks.fetchProductTranslation,
  };
});
vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findUnique: mocks.findUniqueProduct,
      upsert: mocks.upsertProduct,
      update: mocks.updateProduct,
      findMany: vi.fn(async () => []),
    },
    productTranslation: {
      findUnique: mocks.findUniqueTranslation,
      update: mocks.updateTranslation,
    },
    productVariant: {
      findUnique: mocks.findUniqueVariant,
      upsert: mocks.upsertVariant,
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    productCharacteristic: {
      findMany: mocks.findManyCharacteristic,
      upsert: mocks.upsertCharacteristic,
    },
    productTag: { deleteMany: mocks.productTagDeleteMany, create: mocks.productTagCreate },
    productCollection: {
      deleteMany: mocks.productCollectionDeleteMany,
      create: mocks.productCollectionCreate,
    },
    productMedia: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), updateMany: vi.fn() },
    mediaAsset: { findMany: vi.fn(async () => []), updateMany: vi.fn(), deleteMany: vi.fn() },
    productSyncEvent: { update: mocks.updateEvent },
    tag: { upsert: vi.fn(async () => ({ id: "tag-1" })) },
    collection: { findUnique: vi.fn(), findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (ops: unknown) => ops),
  },
}));

import { productExtrasFromShopifySnapshot } from "@/lib/sync/extras";
import {
  applyShopifyProductToSynarava,
  refreshShopifyProductState,
} from "@/lib/shopify/product-sync";

const PRODUCT_GID = "gid://shopify/Product/99";
const LOCAL_ID = "local-1";

const LOCAL_METAFIELD_TRANSLATIONS = {
  ru: { "custom::finish": "Новое RU покрытие" },
  pt: { "custom::finish": "Novo acabamento PT" },
};

const OLD_SHOPIFY_METAFIELD_TRANSLATIONS = {
  ru: { "custom::finish": "Старое RU" },
  pt: { "custom::finish": "Antigo PT" },
};

function remoteProduct() {
  return {
    id: PRODUCT_GID,
    title: "Old EN title",
    handle: "old-handle",
    descriptionHtml: "<p>Old EN</p>",
    vendor: "Synarava",
    productType: "Ring",
    tags: [],
    status: "ACTIVE" as const,
    updatedAt: "2026-01-01T00:00:00Z",
    totalInventory: 1,
    category: null,
    seo: { title: "Old SEO", description: "Old SEO desc" },
    media: { nodes: [] },
    options: [],
    collections: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    resourcePublicationsV2: {
      nodes: [{
        isPublished: true,
        publishDate: "2026-01-01T00:00:00Z",
        publication: { id: "pub", name: "Online Store" },
      }],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    featuredMedia: null,
    variants: {
      nodes: [{
        id: "gid://shopify/ProductVariant/1",
        title: "Default",
        sku: "SKU-1",
        barcode: null,
        price: "100.00",
        compareAtPrice: null,
        inventoryPolicy: "DENY",
        inventoryQuantity: 1,
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
    metafields: {
      nodes: [{
        id: "gid://shopify/Metafield/1",
        namespace: "custom",
        key: "finish",
        type: "single_line_text_field",
        value: "18K Gold PVD",
      }],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  };
}

function localProductRow() {
  return {
    id: LOCAL_ID,
    shopifyProductId: PRODUCT_GID,
    shopifyHandle: "local-handle",
    slug: "local-handle",
    sku: "SKU-1",
    name: "Local EN title",
    description: "<p>Local EN</p>",
    vendor: "Synarava",
    productType: "Ring",
    status: "ACTIVE",
    visibility: "PUBLIC",
    seoTitle: "Local SEO",
    seoDescription: "Local SEO desc",
    shopifyCategoryId: null,
    shopifyCategoryName: null,
    priceCents: 10000,
    compareAtCents: null,
    imageUrl: null,
    publishedAt: new Date("2026-01-01"),
    shopifyUpdatedAt: new Date("2025-12-01"),
    lastSyncedAt: new Date("2025-12-01"),
    syncStatus: "PENDING",
    syncError: null,
    extras: {
      metafields: [{
        namespace: "custom",
        key: "finish",
        type: "single_line_text_field",
        value: "18K Gold PVD",
      }],
      metafieldTranslations: LOCAL_METAFIELD_TRANSLATIONS,
    },
    shopifySnapshot: {
      title: "Older shopify window",
      metafieldTranslations: OLD_SHOPIFY_METAFIELD_TRANSLATIONS,
    },
    tags: [],
    collections: [],
    media: [],
    variants: [{
      id: "variant-1",
      shopifyVariantId: "gid://shopify/ProductVariant/1",
      sku: "SKU-1",
      title: "Default",
      barcode: null,
      priceCents: 10000,
      compareAtCents: null,
      inventoryPolicy: "DENY",
      stockOnHand: 1,
      taxable: true,
      selectedOptions: [{ name: "Title", value: "Default" }],
      shopifyInventoryItemId: "gid://shopify/InventoryItem/1",
      requiresShipping: true,
      tracked: false,
      costCents: null,
      weightGrams: null,
    }],
  };
}

describe("productExtrasFromShopifySnapshot — locale overlays", () => {
  it("does not copy metafieldTranslations into Synarava extras (Shopify observation stays on shopifySnapshot)", () => {
    const extras = productExtrasFromShopifySnapshot({
      media: [],
      metafields: [{ namespace: "custom", key: "finish", type: "single_line_text_field", value: "x" }],
      metafieldTranslations: OLD_SHOPIFY_METAFIELD_TRANSLATIONS,
    });
    expect(extras.metafieldTranslations).toBeUndefined();
    expect(extras.metafields).toBeDefined();
  });
});

describe("refresh + pull preserve local ru/pt after Save-shaped state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublishedStorefrontLocales.mockResolvedValue([
      { code: "en", shopifyLocale: "en", isDefault: true, name: "English" },
      { code: "pt", shopifyLocale: "pt-PT", isDefault: false, name: "Portuguese" },
      { code: "ru", shopifyLocale: "ru", isDefault: false, name: "Russian" },
    ]);
    mocks.metafieldRefsFromNodes.mockReturnValue([
      { id: "gid://shopify/Metafield/1", namespace: "custom", key: "finish", type: "single_line_text_field" },
    ]);
    mocks.fetchCustomMetafieldTranslations.mockResolvedValue(OLD_SHOPIFY_METAFIELD_TRANSLATIONS);
    mocks.fetchProductTranslation.mockResolvedValue({
      handle: "",
      title: "Старое RU название",
      descriptionHtml: "<p>Старое</p>",
      seoTitle: "Старый SEO",
      seoDescription: "Старое SEO",
      updatedAt: "2025-01-01T00:00:00Z",
    });
    mocks.findUniqueTranslation.mockResolvedValue({
      id: "tr-ru",
      productId: LOCAL_ID,
      locale: "ru",
      title: "Новое RU название",
      description: "<p>Новое</p>",
      seoTitle: "Новый SEO",
      seoDescription: "Новое SEO",
      details: { materialsTitle: "Новые материалы" },
      syncStatus: "PENDING",
    });
    mocks.findManyCharacteristic.mockResolvedValue([]);
    mocks.findUniqueVariant.mockResolvedValue({ id: "variant-1", shopifyVariantId: "gid://shopify/ProductVariant/1" });
    mocks.upsertVariant.mockResolvedValue({ id: "variant-1" });
    mocks.upsertCharacteristic.mockResolvedValue({});
    mocks.updateTranslation.mockResolvedValue({});
    mocks.releaseReadyLocalProductMedia.mockResolvedValue(undefined);
    mocks.deleteUnreferencedArchivedProductAssets.mockResolvedValue(undefined);

    const remote = remoteProduct();
    mocks.shopifyAdminRequest.mockImplementation(async (query: string) => {
      if (query.includes("product(id:")) return { product: remote };
      if (query.includes("variants") || query.includes("metafields") || query.includes("collections") || query.includes("resourcePublicationsV2")) {
        return {
          product: {
            variants: remote.variants,
            metafields: remote.metafields,
            collections: remote.collections,
            resourcePublicationsV2: remote.resourcePublicationsV2,
          },
        };
      }
      return { product: remote };
    });
  });

  it("refreshShopifyProductState writes shopifySnapshot only — keeps extras.metafieldTranslations untouched", async () => {
    mocks.findUniqueProduct.mockResolvedValue(localProductRow());
    mocks.updateProduct.mockResolvedValue({ id: LOCAL_ID });

    await refreshShopifyProductState(PRODUCT_GID);

    expect(mocks.updateProduct).toHaveBeenCalledTimes(1);
    const data = mocks.updateProduct.mock.calls[0][0].data;
    expect(data.shopifySnapshot).toBeDefined();
    expect(data.shopifySnapshot.metafieldTranslations).toEqual(OLD_SHOPIFY_METAFIELD_TRANSLATIONS);
    expect(data).not.toHaveProperty("extras");
    expect(data).not.toHaveProperty("name");
    expect(mocks.updateTranslation).not.toHaveBeenCalled();
  });

  it("applyShopifyProductToSynarava (pull) does not replace local extras.metafieldTranslations with old Shopify overlays", async () => {
    const local = localProductRow();
    mocks.findUniqueProduct.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if ("shopifyProductId" in args.where) return local;
      if ("id" in args.where) return local;
      if ("sku" in args.where) return null;
      if ("slug" in args.where) return null;
      return local;
    });
    mocks.upsertProduct.mockImplementation(async ({ update }: { update: Record<string, unknown> }) => ({
      id: LOCAL_ID,
      ...local,
      ...update,
    }));
    mocks.updateProduct.mockResolvedValue({ id: LOCAL_ID });

    await applyShopifyProductToSynarava(PRODUCT_GID, undefined, true);

    expect(mocks.upsertProduct).toHaveBeenCalled();
    const update = mocks.upsertProduct.mock.calls[0][0].update as {
      extras?: { metafieldTranslations?: typeof LOCAL_METAFIELD_TRANSLATIONS };
    };
    expect(update.extras?.metafieldTranslations).toEqual(LOCAL_METAFIELD_TRANSLATIONS);

    // Locale title/body stay local — pull only flags CONFLICT, never content upsert.
    expect(mocks.updateTranslation).toHaveBeenCalled();
    for (const call of mocks.updateTranslation.mock.calls) {
      const data = call[0].data as Record<string, unknown>;
      expect(data).not.toHaveProperty("title");
      expect(data).not.toHaveProperty("description");
      expect(data).not.toHaveProperty("seoTitle");
      expect(data).not.toHaveProperty("details");
      expect(data.syncStatus).toBe("CONFLICT");
    }
  });
});
