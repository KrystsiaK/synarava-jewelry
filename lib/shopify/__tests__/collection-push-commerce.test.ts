import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  shopifyAdminRequest: vi.fn(),
  ensureTranslationBinding: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    collection: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    shopifyTranslationBinding: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown) => ops),
  },
}));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));
vi.mock("@/lib/shopify/translation-sync", () => ({
  ensureTranslationBinding: mocks.ensureTranslationBinding,
}));

import { pushCollectionToShopify } from "@/lib/shopify/collection-presence-server";

describe("pushCollectionToShopify linked update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureTranslationBinding.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue({});
    mocks.findUnique.mockResolvedValue({
      id: "col-1",
      name: "Rings",
      slug: "rings",
      description: "Fine rings",
      seoTitle: "Rings SEO",
      seoDescription: null,
      shopifyCollectionId: "gid://shopify/Collection/1",
      shopifyHandle: "rings",
      workingSnapshot: {
        id: "gid://shopify/Collection/1",
        title: "Rings Local",
        handle: "rings",
        descriptionHtml: "<p>Fine rings</p>",
        seo: { title: "Rings SEO", description: null },
      },
      shopifySnapshot: null,
    });
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        collection: {
          id: "gid://shopify/Collection/1",
          title: "Rings",
          handle: "rings",
          updatedAt: "2026-09-26T00:00:00Z",
          descriptionHtml: "<p>Fine rings</p>",
          seo: { title: "Rings SEO", description: null },
          sources: [],
        },
      })
      .mockResolvedValueOnce({
        collectionUpdate: {
          collection: { id: "gid://shopify/Collection/1", handle: "rings", updatedAt: "2026-09-26T00:00:00Z" },
          userErrors: [],
        },
      })
      .mockResolvedValueOnce({
        collection: {
          id: "gid://shopify/Collection/1",
          title: "Rings Local",
          handle: "rings",
          updatedAt: "2026-09-26T00:00:00Z",
          descriptionHtml: "<p>Fine rings</p>",
          seo: { title: "Rings SEO", description: null },
          sources: [],
        },
      });
  });

  it("issues collectionUpdate for an already-linked collection", async () => {
    const result = await pushCollectionToShopify("col-1");
    expect(result).toEqual({ ok: true, shopifyCollectionId: "gid://shopify/Collection/1" });
    expect(mocks.shopifyAdminRequest).toHaveBeenCalledWith(
      expect.stringContaining("collectionUpdate"),
      expect.objectContaining({
        input: expect.objectContaining({
          id: "gid://shopify/Collection/1",
          title: "Rings Local",
          handle: "rings",
        }),
      }),
    );
  });
});
