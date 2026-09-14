import { beforeEach, describe, expect, it, vi } from "vitest";

const shopifyAdminRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/shopify/admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shopify/admin")>(
    "@/lib/shopify/admin",
  );
  return { ...actual, shopifyAdminRequest };
});

import { reorderShopifyCollectionProduct } from "../collection-order";

describe("reorderShopifyCollectionProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("switches the collection to manual order, moves one product, and returns Shopify's order", async () => {
    shopifyAdminRequest
      .mockResolvedValueOnce({ collection: { id: "gid://shopify/Collection/1", sortOrder: "BEST_SELLING" } })
      .mockResolvedValueOnce({ collectionUpdate: { job: { id: "job-1", done: true }, userErrors: [] } })
      .mockResolvedValueOnce({ collectionReorderProducts: { job: { id: "job-2", done: true }, userErrors: [] } })
      .mockResolvedValueOnce({
        collection: {
          products: {
            nodes: [{ id: "gid://shopify/Product/2" }, { id: "gid://shopify/Product/1" }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });

    await expect(reorderShopifyCollectionProduct({
      collectionId: "gid://shopify/Collection/1",
      productId: "gid://shopify/Product/2",
      newPosition: 0,
    })).resolves.toEqual([
      "gid://shopify/Product/2",
      "gid://shopify/Product/1",
    ]);

    expect(shopifyAdminRequest.mock.calls[1]?.[1]).toEqual({
      collection: { id: "gid://shopify/Collection/1", sortOrder: "MANUAL" },
    });
    expect(shopifyAdminRequest.mock.calls[2]?.[1]).toEqual({
      id: "gid://shopify/Collection/1",
      moves: [{ id: "gid://shopify/Product/2", newPosition: "0" }],
    });
  });

  it("does not update a collection that is already manually sorted", async () => {
    shopifyAdminRequest
      .mockResolvedValueOnce({ collection: { id: "gid://shopify/Collection/1", sortOrder: "MANUAL" } })
      .mockResolvedValueOnce({ collectionReorderProducts: { job: null, userErrors: [] } })
      .mockResolvedValueOnce({
        collection: {
          products: {
            nodes: [{ id: "gid://shopify/Product/1" }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });

    await reorderShopifyCollectionProduct({
      collectionId: "gid://shopify/Collection/1",
      productId: "gid://shopify/Product/1",
      newPosition: 0,
    });

    expect(shopifyAdminRequest).toHaveBeenCalledTimes(3);
    expect(String(shopifyAdminRequest.mock.calls[1]?.[0])).toContain("collectionReorderProducts");
  });
});
