import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PR4 contract: refreshShopifyCollectionState may write shopifySnapshot only.
 * It must never create/change workingSnapshot, collection columns, translations,
 * or syncStatus from compare — conflict SoT is SyncResult leaves.
 */

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
  findUniqueCollection: vi.fn(),
  updateCollection: vi.fn(),
  collectionTranslationUpdateMany: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));
vi.mock("@/lib/db", () => ({
  db: {
    collection: {
      findUnique: mocks.findUniqueCollection,
      update: mocks.updateCollection,
    },
    collectionTranslation: { updateMany: mocks.collectionTranslationUpdateMany },
  },
}));
vi.mock("@/lib/shopify/collection-membership", () => ({
  findManagedCollectionSourceId: vi.fn(() => null),
}));
vi.mock("@/lib/shopify/translation-sync", () => ({
  ensureTranslationBinding: vi.fn(),
}));

import { refreshShopifyCollectionState } from "../collection-presence-server";

function remoteCollection(overrides: { title?: string } = {}) {
  return {
    id: "gid://shopify/Collection/99",
    title: overrides.title ?? "Shopify title",
    handle: "shopify-handle",
    updatedAt: "2026-10-23T12:00:00Z",
    descriptionHtml: "<p>Remote</p>",
    seo: { title: "SEO", description: "Desc" },
    sources: [],
  };
}

describe("refreshShopifyCollectionState — no Synarava writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shopifyAdminRequest.mockResolvedValue({ collection: remoteCollection() });
    mocks.updateCollection.mockResolvedValue({ id: "local-1" });
  });

  it("writes shopifySnapshot and never workingSnapshot or commerce columns", async () => {
    mocks.findUniqueCollection.mockResolvedValue({
      id: "local-1",
      shopifyCollectionId: "gid://shopify/Collection/99",
      workingSnapshot: { title: "Local title", handle: "local-handle" },
      shopifySnapshot: { title: "Old shopify" },
      name: "Local title",
      slug: "local-handle",
      description: "Local",
      seoTitle: null,
      seoDescription: null,
    });

    const result = await refreshShopifyCollectionState("gid://shopify/Collection/99");

    expect(result.collectionId).toBe("local-1");
    expect(mocks.updateCollection).toHaveBeenCalled();
    for (const call of mocks.updateCollection.mock.calls) {
      const data = call[0].data as Record<string, unknown>;
      expect(data.shopifySnapshot).toBeDefined();
      expect(data).not.toHaveProperty("workingSnapshot");
      expect(data).not.toHaveProperty("name");
      expect(data).not.toHaveProperty("slug");
      expect(data).not.toHaveProperty("description");
      expect(data).not.toHaveProperty("seoTitle");
      expect(data).not.toHaveProperty("seoDescription");
    }
    expect(mocks.collectionTranslationUpdateMany).not.toHaveBeenCalled();
  });

  it("returns CONFLICT status without persisting syncStatus when windows differ", async () => {
    mocks.findUniqueCollection.mockResolvedValue({
      id: "local-1",
      shopifyCollectionId: "gid://shopify/Collection/99",
      workingSnapshot: { title: "Local title", handle: "local-handle", descriptionHtml: "", seo: { title: null, description: null } },
      shopifySnapshot: null,
      name: "Local title",
      slug: "local-handle",
      description: null,
      seoTitle: null,
      seoDescription: null,
    });

    const result = await refreshShopifyCollectionState("gid://shopify/Collection/99");

    expect(result.status).toBe("CONFLICT");
    const data = mocks.updateCollection.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("syncStatus");
    expect(data).not.toHaveProperty("syncError");
    expect(data.shopifySnapshot).toBeDefined();
  });
});
