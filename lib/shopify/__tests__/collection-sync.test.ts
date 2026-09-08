import { beforeEach, describe, expect, it, vi } from "vitest";

import { SHOPIFY_MANUAL_SOURCE_TITLE } from "@/lib/shopify/collection-membership";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  updateCollection: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { collection: { update: mocks.updateCollection } },
}));

vi.mock("@/lib/shopify/admin", () => ({
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyAdminRequest: mocks.request,
}));

import { addProductToShopifyCollection } from "@/lib/shopify/collection-sync";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Shopify collection source synchronization", () => {
  it("updates the remembered product source with collectionUpdate", async () => {
    mocks.request
      .mockResolvedValueOnce({
        collection: {
          sources: [{
            id: "gid://shopify/CollectionConditionsSource/3",
            __typename: "CollectionConditionsSource",
            title: SHOPIFY_MANUAL_SOURCE_TITLE,
            targetType: "PRODUCTS",
          }],
        },
      })
      .mockResolvedValueOnce({ collectionUpdate: { job: null, userErrors: [] } });

    await addProductToShopifyCollection({
      id: "local-collection",
      shopifyCollectionId: "gid://shopify/Collection/1",
      shopifyManualSourceId: "gid://shopify/CollectionConditionsSource/3",
    }, "gid://shopify/Product/2");

    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("collectionUpdate(collection: $collection)"),
      {
        collection: {
          id: "gid://shopify/Collection/1",
          sourcesToUpdate: [{
            condition: {
              id: "gid://shopify/CollectionConditionsSource/3",
              inclusion: {
                selectionsToAdd: [{ productId: "gid://shopify/Product/2" }],
              },
            },
          }],
        },
      },
    );
    expect(mocks.updateCollection).not.toHaveBeenCalled();
  });

  it("waits for a new source job and remembers the resulting source id", async () => {
    mocks.request
      .mockResolvedValueOnce({ collection: { sources: [] } })
      .mockResolvedValueOnce({
        collectionUpdate: {
          job: { id: "gid://shopify/Job/4", done: false },
          userErrors: [],
        },
      })
      .mockResolvedValueOnce({ job: { id: "gid://shopify/Job/4", done: true } })
      .mockResolvedValueOnce({
        collection: {
          sources: [{
            id: "gid://shopify/CollectionConditionsSource/5",
            __typename: "CollectionConditionsSource",
            title: SHOPIFY_MANUAL_SOURCE_TITLE,
            targetType: "PRODUCTS",
          }],
        },
      });

    await addProductToShopifyCollection({
      id: "local-collection",
      shopifyCollectionId: "gid://shopify/Collection/1",
      shopifyManualSourceId: null,
    }, "gid://shopify/Product/2");

    expect(mocks.request).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("job(id: $id)"),
      { id: "gid://shopify/Job/4" },
    );
    expect(mocks.updateCollection).toHaveBeenCalledWith({
      where: { id: "local-collection" },
      data: { shopifyManualSourceId: "gid://shopify/CollectionConditionsSource/5" },
    });
  });
});
