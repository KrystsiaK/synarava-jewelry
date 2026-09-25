import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSnapshot: vi.fn(),
  updateSnapshot: vi.fn(),
  findUniqueCollection: vi.fn(),
  updateCollection: vi.fn(),
  createCollection: vi.fn(),
  shopifyAdminRequest: vi.fn(),
  ensureTranslationBinding: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    shopifyCatalogPresenceSnapshot: { findUnique: mocks.findSnapshot, update: mocks.updateSnapshot },
    collection: {
      findUnique: mocks.findUniqueCollection,
      update: mocks.updateCollection,
      create: mocks.createCollection,
    },
  },
}));
vi.mock("@/lib/shopify/admin", () => ({
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyAdminRequest: mocks.shopifyAdminRequest,
}));
vi.mock("@/lib/shopify/collection-membership", () => ({
  findManagedCollectionSourceId: vi.fn(() => null),
}));
vi.mock("@/lib/shopify/translation-sync", () => ({
  ensureTranslationBinding: mocks.ensureTranslationBinding,
}));

import { applyCollectionPresenceDifference } from "@/lib/shopify/collection-presence-server";

const shopifyOnly = {
  id: "shopify-collection:42",
  kind: "SHOPIFY_ONLY" as const,
  localProductId: null,
  shopifyProductId: "gid://shopify/Collection/42",
  name: "Remote kits",
  handle: "remote-kits",
  sku: "",
  localFingerprint: "missing",
  shopifyFingerprint: "remote",
  remoteMissing: false,
  matchReason: null,
  localIdentity: null,
  shopifyIdentity: { name: "Remote kits", handle: "remote-kits", sku: "" },
};

const synaravaOnly = {
  id: "local-7",
  kind: "SYNARAVA_ONLY" as const,
  localProductId: "local-7",
  shopifyProductId: null,
  name: "Local kits",
  handle: "local-kits",
  sku: "",
  localFingerprint: "local",
  shopifyFingerprint: "missing",
  remoteMissing: false,
  matchReason: null,
  localIdentity: { name: "Local kits", handle: "local-kits", sku: "" },
  shopifyIdentity: null,
};

describe("applyCollectionPresenceDifference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSnapshot.mockResolvedValue({ differences: [shopifyOnly, synaravaOnly] });
    mocks.updateSnapshot.mockResolvedValue({});
    mocks.ensureTranslationBinding.mockResolvedValue({});
  });

  it("pulls a Shopify-only collection and removes the saved difference", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      collection: {
        id: "gid://shopify/Collection/42",
        title: "Remote kits",
        handle: "remote-kits",
        updatedAt: "2026-09-23T10:00:00.000Z",
        descriptionHtml: "<p>Hello</p>",
        seo: { title: null, description: null },
        sources: [],
      },
    });
    mocks.findUniqueCollection
      .mockResolvedValueOnce(null) // by shopifyCollectionId
      .mockResolvedValueOnce(null); // by slug
    mocks.createCollection.mockResolvedValue({
      id: "collection-new",
      shopifyCollectionId: "gid://shopify/Collection/42",
    });

    const result = await applyCollectionPresenceDifference({
      difference: shopifyOnly,
      direction: "SHOPIFY_TO_SYNARAVA",
    });

    expect(result).toMatchObject({ ok: true, localCollectionId: "collection-new" });
    expect(mocks.ensureTranslationBinding).toHaveBeenCalledWith({
      resourceType: "COLLECTION",
      entityId: "collection-new",
      shopifyResourceId: "gid://shopify/Collection/42",
    });
    expect(mocks.updateSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      data: { differences: [synaravaOnly] },
    }));
  });

  it("pushes a Synarava-only collection to Shopify", async () => {
    mocks.findUniqueCollection.mockResolvedValue({
      id: "local-7",
      name: "Local kits",
      slug: "local-kits",
      description: "Desc",
      seoTitle: null,
      seoDescription: null,
      shopifyCollectionId: null,
    });
    mocks.shopifyAdminRequest.mockResolvedValue({
      collectionCreate: {
        collection: {
          id: "gid://shopify/Collection/70",
          handle: "local-kits",
          sources: [],
        },
        userErrors: [],
      },
    });
    mocks.updateCollection.mockResolvedValue({ id: "local-7" });

    const result = await applyCollectionPresenceDifference({
      difference: synaravaOnly,
      direction: "SYNARAVA_TO_SHOPIFY",
    });

    expect(result).toMatchObject({ ok: true, localCollectionId: "local-7" });
    expect(mocks.ensureTranslationBinding).toHaveBeenCalledWith({
      resourceType: "COLLECTION",
      entityId: "local-7",
      shopifyResourceId: "gid://shopify/Collection/70",
    });
  });

  it("refuses the impossible direction without writing", async () => {
    const result = await applyCollectionPresenceDifference({
      difference: shopifyOnly,
      direction: "SYNARAVA_TO_SHOPIFY",
    });

    expect(result).toMatchObject({ ok: false, reason: "UNSUPPORTED" });
    expect(mocks.shopifyAdminRequest).not.toHaveBeenCalled();
  });
});
