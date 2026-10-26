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
    collectionTranslation: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
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
      name: "Rings Local",
      slug: "rings",
      description: "Fine rings",
      seoTitle: "Rings SEO",
      seoDescription: null,
      shopifyCollectionId: "gid://shopify/Collection/1",
      shopifyHandle: "rings",
      extras: null,
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

  it("does not unlink or wipe extras when Shopify fetch fails for a non-missing reason", async () => {
    mocks.shopifyAdminRequest.mockReset();
    mocks.shopifyAdminRequest.mockRejectedValueOnce(new Error("Throttled: Exceeded rate limit"));

    await expect(pushCollectionToShopify("col-1")).rejects.toThrow(/Throttled|rate limit/i);

    expect(mocks.update).not.toHaveBeenCalled();
    const { db } = await import("@/lib/db");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("unlinks and clears shopifySnapshot/extras only when Shopify confirms the collection is missing", async () => {
    mocks.shopifyAdminRequest.mockReset();
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ collection: null })
      .mockResolvedValueOnce({
        collectionCreate: {
          collection: {
            id: "gid://shopify/Collection/99",
            handle: "rings",
            sources: [],
          },
          userErrors: [],
        },
      })
      .mockResolvedValueOnce({
        collection: {
          id: "gid://shopify/Collection/99",
          title: "Rings Local",
          handle: "rings",
          updatedAt: "2026-09-26T00:00:00Z",
          descriptionHtml: "<p>Fine rings</p>",
          seo: { title: "Rings SEO", description: null },
          sources: [],
        },
      });

    const { db } = await import("@/lib/db");
    const { Prisma } = await import("@prisma/client");
    await pushCollectionToShopify("col-1");

    expect(db.$transaction).toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopifyCollectionId: null,
          shopifySnapshot: Prisma.JsonNull,
          extras: Prisma.JsonNull,
          syncStatus: "UNLINKED",
        }),
      }),
    );
    for (const call of mocks.update.mock.calls) {
      expect(call[0].data).not.toHaveProperty("workingSnapshot");
    }
  });
});
