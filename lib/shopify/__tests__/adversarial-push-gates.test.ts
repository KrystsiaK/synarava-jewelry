/**
 * Phase 1 adversarial push / productSet / multi-variant / cost gates.
 * Findings: docs/audits/2026-10-28-sync-adversarial.md
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/sku/config", () => ({ getSkuServiceConfig: mocks.getSkuServiceConfig }));
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

function remoteProduct(opts?: {
  unitCostAmount?: string;
  variantCount?: number;
  mediaNodes?: Array<Record<string, unknown>>;
}) {
  const variantCount = opts?.variantCount ?? 1;
  const variants = Array.from({ length: variantCount }, (_, index) => ({
    id: `gid://shopify/ProductVariant/${index + 1}`,
    title: index === 0 ? "Default Title" : `Option ${index}`,
    sku: `SKU-${index + 1}`,
    barcode: null,
    price: "10.00",
    compareAtPrice: null,
    inventoryPolicy: "DENY" as const,
    inventoryQuantity: 1,
    taxable: true,
    selectedOptions: [{ name: "Title", value: index === 0 ? "Default Title" : `V${index}` }],
    inventoryItem: {
      id: `gid://shopify/InventoryItem/${index + 1}`,
      requiresShipping: true,
      tracked: false,
      countryCodeOfOrigin: null,
      harmonizedSystemCode: null,
      unitCost: opts?.unitCostAmount
        ? { amount: opts.unitCostAmount, currencyCode: "EUR" }
        : null,
      measurement: null,
    },
  }));
  return {
    id: "gid://shopify/Product/1",
    title: "Ring",
    handle: "ring",
    descriptionHtml: "<p>Ring</p>",
    vendor: "Synarava",
    productType: "Ring",
    tags: [],
    status: "ACTIVE" as const,
    updatedAt: "2026-10-28T00:00:00Z",
    totalInventory: 1,
    category: null,
    seo: { title: null, description: null },
    media: { nodes: opts?.mediaNodes ?? [] },
    options: [{ id: "opt", name: "Title", position: 1, values: variants.map((v) => v.title) }],
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
    variants: { nodes: variants, pageInfo: { hasNextPage: false, endCursor: null } },
    metafields: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  };
}

function localProduct(opts: {
  shopifyProductId: string | null;
  costCents: number | null;
  variantCount?: number;
  extrasMedia?: Array<Record<string, unknown>>;
  media?: Array<Record<string, unknown>>;
}) {
  const variantCount = opts.variantCount ?? 1;
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
    extras: opts.extrasMedia ? { media: opts.extrasMedia } : null,
    shopifySnapshot: null,
    characteristics: [],
    variants: Array.from({ length: variantCount }, (_, index) => ({
      id: `var-${index + 1}`,
      sku: `SKU-${index + 1}`,
      priceCents: 1000,
      compareAtCents: null,
      costCents: opts.costCents,
      taxable: true,
      stockOnHand: 1,
      shopifyVariantId: opts.shopifyProductId ? `gid://shopify/ProductVariant/${index + 1}` : null,
      shopifyInventoryItemId: opts.shopifyProductId ? `gid://shopify/InventoryItem/${index + 1}` : null,
    })),
    tags: [],
    collections: [],
    media: opts.media ?? [],
    translations: [],
  };
}

function productSetFilesFromCalls(): Array<{ id?: string; filename?: string; originalSource?: string }> {
  const call = mocks.shopifyAdminRequest.mock.calls.find(
    ([query]) => typeof query === "string" && query.includes("productSet"),
  );
  const files = (call?.[1] as { input?: { files?: Array<{ id?: string; filename?: string; originalSource?: string }> } } | undefined)
    ?.input?.files;
  return files ?? [];
}

function mockHappyPath(remote: ReturnType<typeof remoteProduct>) {
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
          productVariants: remote.variants.nodes,
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
    if (query.includes("locations(")) return { locations: { nodes: [] } };
    return {};
  });
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

describe("adversarial: cost never in linked push", () => {
  it("linked productSet input omits variants (no cost channel) and bulk update has no cost", async () => {
    const remote = remoteProduct({ unitCostAmount: "24.56" });
    mocks.findUniqueOrThrowProduct.mockResolvedValue(
      localProduct({ shopifyProductId: remote.id, costCents: 9999 }),
    );
    mockHappyPath(remote);

    const result = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });
    expect(result.ok).toBe(true);

    const set = mocks.shopifyAdminRequest.mock.calls.find(
      ([query]) => typeof query === "string" && query.includes("productSet"),
    );
    const setInput = (set?.[1] as { input?: Record<string, unknown> } | undefined)?.input;
    expect(setInput).toBeDefined();
    expect(setInput).not.toHaveProperty("variants");

    const bulk = mocks.shopifyAdminRequest.mock.calls.find(
      ([query]) => typeof query === "string" && query.includes("productVariantsBulkUpdate"),
    );
    const inventory = (bulk?.[1] as { variants?: Array<{ inventoryItem?: Record<string, unknown> }> } | undefined)
      ?.variants?.[0]?.inventoryItem;
    expect(inventory).toBeDefined();
    expect(inventory).not.toHaveProperty("cost");
  });
});

describe("adversarial: multi-variant Keep ours blocked on push", () => {
  it("returns ok:false with MULTI_VARIANT_PUSH_BLOCKED_REASON for linked multi-variant", async () => {
    const remote = remoteProduct({ variantCount: 2 });
    mocks.findUniqueOrThrowProduct.mockResolvedValue(
      localProduct({ shopifyProductId: remote.id, costCents: null, variantCount: 2 }),
    );
    mockHappyPath(remote);

    const result = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });
    expect(result).toEqual({
      ok: false,
      error: MULTI_VARIANT_PUSH_BLOCKED_REASON,
    });
  });
});

describe("adversarial: productSet media files have unique gids", () => {
  it("dedupes the same Shopify media gid when it appears twice in extras.media", async () => {
    const gid = "gid://shopify/MediaImage/1";
    const remote = remoteProduct({
      mediaNodes: [{
        id: gid,
        alt: "Front",
        status: "READY",
        preview: { image: { url: "https://cdn.shopify.com/files/a.jpg" } },
        image: { url: "https://cdn.shopify.com/files/a.jpg" },
      }],
    });
    mocks.findUniqueOrThrowProduct.mockResolvedValue(
      localProduct({
        shopifyProductId: remote.id,
        costCents: null,
        extrasMedia: [
          { id: gid, alt: "Front", preview: { image: { url: "https://cdn.shopify.com/files/a.jpg" } } },
          { id: gid, alt: "Front copy", preview: { image: { url: "https://cdn.shopify.com/files/a.jpg" } } },
        ],
      }),
    );
    mockHappyPath(remote);

    const result = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });
    expect(result.ok).toBe(true);

    const files = productSetFilesFromCalls();
    const ids = files.map((file) => file.id).filter(Boolean);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it("documents remoteByFilename Map last-wins for local asset correlation", async () => {
    // Hypothesis SYNC-ADV-H1 (not a failing invariant): when two remotes share a
    // filename, local primaryAsset matching that filename binds to Map.get last.
    // extras.media GID append still preserves listed gids — so productSet may keep
    // both when the gallery tree lists them. See audit hypotheses.
    const remote = remoteProduct({
      mediaNodes: [
        {
          id: "gid://shopify/MediaImage/1",
          alt: "A",
          status: "READY",
          preview: { image: { url: "https://cdn.shopify.com/files/same.jpg?v=1" } },
          image: { url: "https://cdn.shopify.com/files/same.jpg?v=1" },
        },
        {
          id: "gid://shopify/MediaImage/2",
          alt: "B",
          status: "READY",
          preview: { image: { url: "https://cdn.shopify.com/files/same.jpg?v=2" } },
          image: { url: "https://cdn.shopify.com/files/same.jpg?v=2" },
        },
      ],
    });
    mocks.findUniqueOrThrowProduct.mockResolvedValue(
      localProduct({
        shopifyProductId: remote.id,
        costCents: null,
        extrasMedia: [
          {
            id: "gid://shopify/MediaImage/1",
            alt: "A",
            preview: { image: { url: "https://cdn.shopify.com/files/same.jpg?v=1" } },
          },
          {
            id: "gid://shopify/MediaImage/2",
            alt: "B",
            preview: { image: { url: "https://cdn.shopify.com/files/same.jpg?v=2" } },
          },
        ],
      }),
    );
    mockHappyPath(remote);

    const result = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });
    expect(result.ok).toBe(true);
    const ids = productSetFilesFromCalls().map((file) => file.id).filter(Boolean);
    expect(ids).toEqual([...new Set(ids)]);
    expect(ids.toSorted()).toEqual([
      "gid://shopify/MediaImage/1",
      "gid://shopify/MediaImage/2",
    ].toSorted());
  });
});
