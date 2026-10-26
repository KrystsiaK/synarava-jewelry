import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUniqueCollection: vi.fn(),
  updateCollection: vi.fn(),
  updateTranslations: vi.fn(),
  findFirstCollection: vi.fn(),
  shopifyAdminRequest: vi.fn(),
  findManagedCollectionSourceId: vi.fn(() => null),
  ensureTranslationBinding: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    collection: {
      findUnique: mocks.findUniqueCollection,
      findFirst: mocks.findFirstCollection,
      update: mocks.updateCollection,
    },
    collectionTranslation: { updateMany: mocks.updateTranslations },
  },
}));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));
vi.mock("@/lib/shopify/collection-membership", () => ({
  findManagedCollectionSourceId: mocks.findManagedCollectionSourceId,
}));
vi.mock("@/lib/shopify/translation-sync", () => ({
  ensureTranslationBinding: mocks.ensureTranslationBinding,
}));

import { createHash } from "node:crypto";
import { applyCollectionCommerceField } from "../collection-commerce-field-apply";

function fp(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function linkedCollection(overrides: Record<string, unknown> = {}) {
  return {
    id: "col-1",
    shopifyCollectionId: "gid://shopify/Collection/9",
    name: "Local name",
    slug: "local-handle",
    description: "Local desc",
    seoTitle: "Local SEO",
    seoDescription: "Local SEO desc",
    extras: null,
    shopifySnapshot: {
      id: "gid://shopify/Collection/9",
      title: "Shopify name",
      handle: "shopify-handle",
      descriptionHtml: "<p>Shopify desc</p>",
      seo: { title: "Shopify SEO", description: "Shopify SEO desc" },
    },
    ...overrides,
  };
}

describe("applyCollectionCommerceField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirstCollection.mockResolvedValue(null);
    mocks.updateTranslations.mockResolvedValue({ count: 1 });
  });

  it("adopts Name from Shopify into Synarava columns (OUR window derived)", async () => {
    const before = linkedCollection();
    const afterLocal = {
      ...before,
      name: "Shopify name",
    };
    mocks.findUniqueCollection
      .mockResolvedValueOnce(before) // initial read
      .mockResolvedValueOnce(before) // writeLocally read
      .mockResolvedValueOnce(afterLocal); // post-write re-check
    mocks.updateCollection.mockResolvedValue(afterLocal);

    const result = await applyCollectionCommerceField({
      collectionId: "col-1",
      label: "Name",
      direction: "SHOPIFY_TO_SYNARAVA",
      expectedLocalFingerprint: fp("Local name"),
      expectedShopifyFingerprint: fp("Shopify name"),
    });

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(mocks.updateCollection).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "col-1" },
      data: expect.objectContaining({ name: "Shopify name" }),
    }));
    expect(mocks.updateCollection.mock.calls[0][0].data).not.toHaveProperty("workingSnapshot");
    expect(mocks.shopifyAdminRequest).not.toHaveBeenCalled();
  });

  it("applies Name for a collection with columns only — same window the compare derives", async () => {
    const before = linkedCollection({ extras: null });
    const afterLocal = {
      ...before,
      name: "Shopify name",
      shopifySnapshot: { ...(before.shopifySnapshot as object), handle: "local-handle" },
    };
    mocks.findUniqueCollection
      .mockResolvedValueOnce(before) // initial read
      .mockResolvedValueOnce(before) // writeLocally read
      .mockResolvedValueOnce(afterLocal); // post-write re-check
    mocks.updateCollection.mockResolvedValue(afterLocal);

    const result = await applyCollectionCommerceField({
      collectionId: "col-1",
      label: "Name",
      direction: "SHOPIFY_TO_SYNARAVA",
      expectedLocalFingerprint: fp("Local name"),
      expectedShopifyFingerprint: fp("Shopify name"),
    });

    expect(result).toEqual(expect.objectContaining({ ok: true }));
  });

  it("pushes Handle to Shopify then refreshes shopifySnapshot only on success path", async () => {
    const before = linkedCollection();
    const afterShopify = {
      ...(before.shopifySnapshot as object),
      handle: "local-handle",
    };
    const afterLocal = {
      ...before,
      slug: "local-handle",
      shopifySnapshot: afterShopify,
    };
    mocks.findUniqueCollection
      .mockResolvedValueOnce(before) // initial
      .mockResolvedValueOnce(before) // writeToShopify
      .mockResolvedValueOnce({ // refreshShopifyCollectionState lookup
        id: "col-1",
        extras: null,
        shopifySnapshot: before.shopifySnapshot,
        name: "Local name",
        slug: "local-handle",
        description: "Local desc",
        seoTitle: "Local SEO",
        seoDescription: "Local SEO desc",
        shopifyCollectionId: before.shopifyCollectionId,
      })
      .mockResolvedValueOnce(afterLocal); // post-write re-check
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        collectionUpdate: {
          collection: { id: "gid://shopify/Collection/9", handle: "local-handle", updatedAt: "2026-10-23T12:00:00Z" },
          userErrors: [],
        },
      })
      .mockResolvedValueOnce({
        collection: {
          id: "gid://shopify/Collection/9",
          title: "Local name",
          handle: "local-handle",
          updatedAt: "2026-10-23T12:00:00Z",
          descriptionHtml: "<p>Local desc</p>",
          seo: { title: "Local SEO", description: "Local SEO desc" },
          sources: [],
        },
      });
    mocks.updateCollection.mockResolvedValue(afterLocal);

    const result = await applyCollectionCommerceField({
      collectionId: "col-1",
      label: "Handle",
      direction: "SYNARAVA_TO_SHOPIFY",
      expectedLocalFingerprint: fp("local-handle"),
      expectedShopifyFingerprint: fp("shopify-handle"),
    });

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(mocks.shopifyAdminRequest).toHaveBeenCalled();
    const refreshData = mocks.updateCollection.mock.calls
      .map((call) => call[0].data as Record<string, unknown>)
      .find((data) => data.shopifySnapshot != null);
    expect(refreshData).toBeDefined();
    expect(refreshData).not.toHaveProperty("workingSnapshot");
  });

  it("rejects unsupported labels", async () => {
    mocks.findUniqueCollection.mockResolvedValue(linkedCollection());
    const result = await applyCollectionCommerceField({
      collectionId: "col-1",
      label: "Tags",
      direction: "SHOPIFY_TO_SYNARAVA",
      expectedLocalFingerprint: fp("a"),
      expectedShopifyFingerprint: fp("b"),
    });
    expect(result).toMatchObject({ ok: false, reason: "UNSUPPORTED" });
  });
});
