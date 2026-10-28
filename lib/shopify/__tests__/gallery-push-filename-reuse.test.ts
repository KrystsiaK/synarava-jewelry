/**
 * Gallery push: reuse remote gid by staged UUID filename; local:→gid handoff.
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
  getS3: vi.fn(),
  getS3Bucket: vi.fn(() => "test-bucket"),
  fetch: vi.fn(),
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
vi.mock("@/lib/s3", () => ({
  getS3: mocks.getS3,
  getS3Bucket: mocks.getS3Bucket,
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

import { compareSyncState } from "@/lib/sync/compare";
import { pushProductToShopify } from "@/lib/shopify/product-sync";

const STAGED_FILENAME = "ring-front-550e8400-e29b-41d4-a716-446655440000.webp";
const ASSET_ID = "asset-550e8400";
const MEDIA_GID = "gid://shopify/MediaImage/99";
const PRODUCT_GID = "gid://shopify/Product/1";

function mediaNode(id: string, filename: string, alt = "New") {
  return {
    id,
    alt,
    mediaContentType: "IMAGE",
    status: "READY",
    originalSource: { url: `https://cdn.shopify.com/files/${filename}` },
    preview: { image: { url: `https://cdn.shopify.com/files/${filename}`, width: 100, height: 100 } },
    image: { url: `https://cdn.shopify.com/files/${filename}`, width: 100, height: 100 },
  };
}

function remoteProduct(mediaNodes: Array<Record<string, unknown>> = []) {
  return {
    id: PRODUCT_GID,
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
    media: { nodes: mediaNodes },
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
    featuredMedia: mediaNodes[0]
      ? { preview: { image: { url: (mediaNodes[0] as { preview: { image: { url: string } } }).preview.image.url } } }
      : null,
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

function localProduct(opts: {
  extrasMedia: Array<Record<string, unknown>>;
  mediaRows: Array<{
    assetId: string;
    alt: string;
    filename: string;
  }>;
  shopifySnapshot?: unknown;
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
    shopifyProductId: PRODUCT_GID,
    shopifyHandle: "ring",
    shopifyCategoryId: null,
    shopifyCategoryName: null,
    imageUrl: null,
    primaryAssetId: null,
    primaryAsset: null,
    details: null,
    extras: { media: opts.extrasMedia },
    shopifySnapshot: opts.shopifySnapshot ?? null,
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
    media: opts.mediaRows.map((row, index) => ({
      assetId: row.assetId,
      alt: row.alt,
      sortOrder: index,
      asset: {
        id: row.assetId,
        filename: row.filename,
        key: `uploads/products/${row.filename}`,
        mimeType: "image/webp",
        source: "UPLOAD",
      },
    })),
    translations: [],
  };
}

function productSetCalls(): Array<Array<{ id?: string; filename?: string; originalSource?: string; alt?: string }>> {
  return mocks.shopifyAdminRequest.mock.calls
    .filter(([query]) => typeof query === "string" && query.includes("productSet"))
    .map((call) => {
      const files = (call[1] as { input?: { files?: Array<{ id?: string; filename?: string; originalSource?: string; alt?: string }> } } | undefined)
        ?.input?.files;
      return files ?? [];
    });
}

function stagedUploadsCallCount(): number {
  return mocks.shopifyAdminRequest.mock.calls.filter(
    ([query]) => typeof query === "string" && query.includes("stagedUploadsCreate"),
  ).length;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
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
  mocks.getS3.mockReturnValue({
    send: vi.fn(async () => ({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    })),
  });
  mocks.fetch.mockResolvedValue({ ok: true });
});

describe("gallery push filename reuse + local→gid handoff", () => {
  it("retried push after partial failure reuses remote gid by filename — file count unchanged", async () => {
    // Remote already has the photo from the failed attempt; Synarava still has local:.
    const remote = remoteProduct([mediaNode(MEDIA_GID, STAGED_FILENAME)]);
    mocks.findUniqueOrThrowProduct.mockResolvedValue(
      localProduct({
        extrasMedia: [{
          id: `local:${ASSET_ID}`,
          alt: "New",
          mediaContentType: "IMAGE",
          preview: { image: { url: `https://s3.example/${STAGED_FILENAME}`, width: 100, height: 100 } },
          image: { url: `https://s3.example/${STAGED_FILENAME}`, width: 100, height: 100 },
        }],
        mediaRows: [{ assetId: ASSET_ID, alt: "New", filename: STAGED_FILENAME }],
        shopifySnapshot: { title: "Ring", media: remote.media.nodes },
      }),
    );
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
      if (query.includes("stagedUploadsCreate")) {
        throw new Error("must not stage when remote filename already exists");
      }
      if (query.includes("locations(")) return { locations: { nodes: [] } };
      return {};
    });

    const first = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });
    expect(first.ok).toBe(true);
    expect(stagedUploadsCallCount()).toBe(0);
    const files1 = productSetCalls().at(-1);
    expect(files1).toEqual([{ id: MEDIA_GID, alt: "New" }]);

    // Second push with same local state still sends one file (same gid).
    const second = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });
    expect(second.ok).toBe(true);
    expect(stagedUploadsCallCount()).toBe(0);
    const files2 = productSetCalls().at(-1);
    expect(files2).toEqual(files1);
    expect(files2).toHaveLength(1);
  });

  it("Keep-ours added photo: real push handoff local:→gid, compare 0 leaves, second push same files", async () => {
    const remoteBefore = remoteProduct([]);
    const remoteAfter = remoteProduct([mediaNode(MEDIA_GID, STAGED_FILENAME)]);
    const localPending = localProduct({
      extrasMedia: [{
        id: `local:${ASSET_ID}`,
        alt: "New",
        mediaContentType: "IMAGE",
        preview: { image: { url: `https://s3.example/${STAGED_FILENAME}`, width: 100, height: 100 } },
        image: { url: `https://s3.example/${STAGED_FILENAME}`, width: 100, height: 100 },
      }],
      mediaRows: [{ assetId: ASSET_ID, alt: "New", filename: STAGED_FILENAME }],
      shopifySnapshot: { title: "Ring", media: [] },
    });
    mocks.findUniqueOrThrowProduct.mockResolvedValue(localPending);

    let productFetches = 0;
    mocks.shopifyAdminRequest.mockImplementation(async (query: string) => {
      if (query.includes("stagedUploadsCreate")) {
        return {
          stagedUploadsCreate: {
            stagedTargets: [{
              url: "https://upload.example/stage",
              resourceUrl: "https://upload.example/resource",
              parameters: [],
            }],
            userErrors: [],
          },
        };
      }
      if (query.includes("productSet")) {
        return { productSet: { product: remoteAfter, userErrors: [] } };
      }
      if (query.includes("query SynaravaProduct") || query.includes("product(id:")) {
        productFetches += 1;
        // First fetch = currentRemote (empty); later fetches = settled READY media.
        return { product: productFetches <= 1 ? remoteBefore : remoteAfter };
      }
      if (query.includes("publishablePublish") || query.includes("publishableUnpublish")) {
        return { publishablePublish: { userErrors: [] }, publishableUnpublish: { userErrors: [] } };
      }
      if (query.includes("productVariantsBulkUpdate")) {
        return {
          productVariantsBulkUpdate: {
            productVariants: remoteAfter.variants.nodes,
            userErrors: [],
          },
        };
      }
      if (query.includes("locations(")) return { locations: { nodes: [] } };
      return {};
    });

    const push1 = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });
    expect(push1.ok).toBe(true);
    expect(stagedUploadsCallCount()).toBe(1);
    const files1 = productSetCalls().at(-1)!;
    expect(files1).toHaveLength(1);
    expect(files1[0]?.filename).toBe(STAGED_FILENAME);
    expect(files1[0]?.originalSource).toBeTruthy();
    expect(files1[0]?.id).toBeUndefined();

    const written = mocks.updateProduct.mock.calls.at(-1)?.[0] as {
      data?: { extras?: { media?: Array<{ id?: string; alt?: string }> }; shopifySnapshot?: { media?: unknown[] } };
    } | undefined;
    const writtenMedia = written?.data?.extras?.media ?? [];
    expect(writtenMedia.some((node) => node.id === MEDIA_GID)).toBe(true);
    expect(writtenMedia.every((node) => !String(node.id ?? "").startsWith("local:"))).toBe(true);

    const ourWindow = {
      title: "Ring",
      media: writtenMedia,
    };
    const shopifySnapshot = {
      title: "Ring",
      media: remoteAfter.media.nodes,
    };
    const compare = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "product-1",
        ourWindow,
        shopifySnapshot,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [
        { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      ],
      connected: true,
      checkedAt: "2026-10-28T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-28T12:01:00.000Z"),
    });
    const mediaLeaves = compare.leaves.filter(
      (leaf) => leaf.kind === "commerce" && leaf.section === "media",
    );
    expect(mediaLeaves).toHaveLength(0);

    // Second push: Synarava extras already hold the gid (post-handoff).
    mocks.findUniqueOrThrowProduct.mockResolvedValue(
      localProduct({
        extrasMedia: writtenMedia as Array<Record<string, unknown>>,
        mediaRows: [],
        shopifySnapshot,
      }),
    );
    mocks.shopifyAdminRequest.mockClear();
    mocks.shopifyAdminRequest.mockImplementation(async (query: string) => {
      if (query.includes("stagedUploadsCreate")) {
        throw new Error("second push must not re-upload");
      }
      if (query.includes("query SynaravaProduct") || query.includes("product(id:")) {
        return { product: remoteAfter };
      }
      if (query.includes("productSet")) {
        return { productSet: { product: remoteAfter, userErrors: [] } };
      }
      if (query.includes("publishablePublish") || query.includes("publishableUnpublish")) {
        return { publishablePublish: { userErrors: [] }, publishableUnpublish: { userErrors: [] } };
      }
      if (query.includes("productVariantsBulkUpdate")) {
        return {
          productVariantsBulkUpdate: {
            productVariants: remoteAfter.variants.nodes,
            userErrors: [],
          },
        };
      }
      if (query.includes("locations(")) return { locations: { nodes: [] } };
      return {};
    });

    const push2 = await pushProductToShopify("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });
    expect(push2.ok).toBe(true);
    expect(stagedUploadsCallCount()).toBe(0);
    const files2 = productSetCalls().at(-1);
    expect(files2).toEqual([{ id: MEDIA_GID, alt: "New" }]);
    expect(files2).toHaveLength(files1.length);
  });
});
