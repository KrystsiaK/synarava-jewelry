import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PR2 contract: inspectProductSyncState may refresh the Shopify-side copy and
 * compute status in memory. It must never create/change workingSnapshot,
 * product commerce columns, translations, TaxonomyValueLabel, or syncStatus.
 */

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
  findUniqueOrThrowProduct: vi.fn(),
  updateProduct: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
  taxonomyUpsert: vi.fn(),
  taxonomyCreateMany: vi.fn(),
  productTranslationUpsert: vi.fn(),
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
    product: {
      findUniqueOrThrow: mocks.findUniqueOrThrowProduct,
      update: mocks.updateProduct,
    },
    taxonomyValueLabel: {
      upsert: mocks.taxonomyUpsert,
      createMany: mocks.taxonomyCreateMany,
    },
    productTranslation: { upsert: mocks.productTranslationUpsert },
  },
}));

import { inspectProductSyncState } from "../product-sync";

function remoteProduct(overrides: { title?: string; price?: string } = {}) {
  return {
    id: "gid://shopify/Product/99",
    title: overrides.title ?? "Shopify title",
    handle: "shopify-handle",
    descriptionHtml: "<p>Remote</p>",
    vendor: "Synarava",
    productType: "Ring",
    tags: ["a"],
    status: "ACTIVE" as const,
    updatedAt: "2026-10-23T12:00:00Z",
    totalInventory: 3,
    category: null,
    seo: { title: null, description: null },
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
        price: overrides.price ?? "100.00",
        compareAtPrice: null,
        inventoryPolicy: "DENY",
        inventoryQuantity: 3,
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

function localProduct(overrides: {
  workingSnapshot?: unknown;
  name?: string;
} = {}) {
  return {
    shopifyProductId: "gid://shopify/Product/99",
    shopifySnapshot: { title: "Old shopify" },
    workingSnapshot: overrides.workingSnapshot === undefined
      ? { title: "Local title", handle: "local-handle" }
      : overrides.workingSnapshot,
    name: overrides.name ?? "Local title",
    slug: "local-handle",
    vendor: "Synarava",
    productType: "Ring",
    priceCents: 10000,
    variants: [{
      shopifyVariantId: "gid://shopify/ProductVariant/1",
      sku: "SKU-1",
      priceCents: 10000,
      taxable: true,
      stockOnHand: 2,
    }],
  };
}

function allUpdateData() {
  return mocks.updateProduct.mock.calls.map((call) => call[0].data as Record<string, unknown>);
}

describe("inspectProductSyncState — no Synarava writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublishedStorefrontLocales.mockResolvedValue([
      { code: "en", shopifyLocale: "en", isDefault: true, name: "English" },
    ]);
    mocks.shopifyAdminRequest.mockResolvedValue({
      product: remoteProduct({ title: "Shopify title", price: "55.00" }),
    });
    mocks.updateProduct.mockResolvedValue({ id: "local-1" });
  });

  it("builds compare window from columns when workingSnapshot is missing — no Adopt", async () => {
    mocks.findUniqueOrThrowProduct.mockResolvedValue(localProduct({ workingSnapshot: null }));

    const inspection = await inspectProductSyncState("local-1");

    expect(inspection.workingSnapshotMissing).toBe(false);
    expect(inspection.differences.some((d) => d.field === "Adopt Shopify" || d.path === "_adopt")).toBe(false);

    for (const data of allUpdateData()) {
      expect(data).not.toHaveProperty("workingSnapshot");
      expect(data).not.toHaveProperty("name");
      expect(data).not.toHaveProperty("priceCents");
      expect(data).not.toHaveProperty("slug");
      expect(data).not.toHaveProperty("description");
      expect(data).not.toHaveProperty("vendor");
      expect(data).not.toHaveProperty("productType");
    }
    expect(mocks.taxonomyUpsert).not.toHaveBeenCalled();
    expect(mocks.taxonomyCreateMany).not.toHaveBeenCalled();
    expect(mocks.productTranslationUpsert).not.toHaveBeenCalled();
  });

  it("refreshes shopifySnapshot and never rewrites workingSnapshot or syncStatus", async () => {
    const existingWorking = {
      title: "Local title",
      handle: "local-handle",
      metafields: {
        "custom.color": { namespace: "custom", key: "color", value: "gid://1", type: "product_taxonomy_value_reference" },
      },
    };
    mocks.findUniqueOrThrowProduct.mockResolvedValue(localProduct({ workingSnapshot: existingWorking }));

    const inspection = await inspectProductSyncState("local-1");

    expect(inspection.state).toBe("CONFLICT");
    expect(mocks.updateProduct).toHaveBeenCalled();
    for (const data of allUpdateData()) {
      expect(data.shopifySnapshot).toBeDefined();
      expect((data.shopifySnapshot as { title?: string }).title).toBe("Shopify title");
      expect(data).not.toHaveProperty("workingSnapshot");
      expect(data).not.toHaveProperty("name");
      expect(data).not.toHaveProperty("syncStatus");
      expect(data).not.toHaveProperty("syncError");
      expect(data).not.toHaveProperty("lastSyncedAt");
    }
  });

  it("returns UNLINKED without writing when product has no Shopify id", async () => {
    mocks.findUniqueOrThrowProduct.mockResolvedValue({
      ...localProduct(),
      shopifyProductId: null,
    });

    const inspection = await inspectProductSyncState("local-1");

    expect(inspection).toEqual({
      state: "UNLINKED",
      remoteUpdatedAt: null,
      publications: [],
      differences: [],
    });
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.shopifyAdminRequest).not.toHaveBeenCalled();
  });
});
