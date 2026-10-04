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

import {
  addProductToShopifyCollection,
  removeProductFromShopifyCollection,
} from "@/lib/shopify/collection-sync";
import { ShopifyAdminError } from "@/lib/shopify/admin";

beforeEach(() => {
  vi.resetAllMocks();
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

  it("falls back to collectionRemoveProducts when selectionsToRemove empties a condition source", async () => {
    mocks.request
      .mockResolvedValueOnce({ collection: { sources: [{ id: "gid://shopify/CollectionConditionsSource/3", __typename: "CollectionConditionsSource", title: SHOPIFY_MANUAL_SOURCE_TITLE, targetType: "PRODUCTS" }] } })
      .mockResolvedValueOnce({
        collectionUpdate: {
          job: null,
          userErrors: [{
            message: "A condition based source must have at least one product selection or condition",
          }],
        },
      })
      .mockResolvedValueOnce({
        collectionRemoveProducts: { job: null, userErrors: [] },
      });

    await removeProductFromShopifyCollection({
      shopifyCollectionId: "gid://shopify/Collection/1",
      shopifyManualSourceId: "gid://shopify/CollectionConditionsSource/3",
    }, "gid://shopify/Product/2");

    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("collectionUpdate(collection: $collection)"),
      expect.objectContaining({
        collection: expect.objectContaining({
          sourcesToUpdate: [expect.objectContaining({
            condition: expect.objectContaining({
              inclusion: {
                selectionsToRemove: [{ productId: "gid://shopify/Product/2" }],
              },
            }),
          })],
        }),
      }),
    );
    expect(mocks.request).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("collectionRemoveProducts"),
      {
        id: "gid://shopify/Collection/1",
        productIds: ["gid://shopify/Product/2"],
      },
    );
  });

  it("surfaces collection id when membership ADD fails", async () => {
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
      .mockResolvedValueOnce({
        collectionUpdate: {
          job: null,
          userErrors: [{ message: "boom" }],
        },
      });

    try {
      await addProductToShopifyCollection({
        id: "local-collection",
        shopifyCollectionId: "gid://shopify/Collection/1",
        shopifyManualSourceId: "gid://shopify/CollectionConditionsSource/3",
      }, "gid://shopify/Product/2");
      expect.unreachable("expected membership ADD to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ShopifyAdminError);
      expect((error as Error).message).toMatch(
        /Collection membership ADD failed for gid:\/\/shopify\/Collection\/1: boom/,
      );
    }
  });
});

it("treats removal from a missing collection as already removed", async () => {
  mocks.request.mockResolvedValueOnce({ collection: null });
  await expect(removeProductFromShopifyCollection({ shopifyCollectionId: "c1", shopifyManualSourceId: "stale" }, "p1")).resolves.toBeUndefined();
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

it("refreshes a stale source id before removing membership", async () => {
  mocks.request.mockResolvedValueOnce({ collection: { sources: [{ id: "live", __typename: "CollectionConditionsSource", title: SHOPIFY_MANUAL_SOURCE_TITLE, targetType: "PRODUCTS" }] } })
    .mockResolvedValueOnce({ collectionUpdate: { job: null, userErrors: [] } });
  await removeProductFromShopifyCollection({ shopifyCollectionId: "c1", shopifyManualSourceId: "stale" }, "p1");
  expect(mocks.request.mock.calls[1][1].collection.sourcesToUpdate[0].condition.id).toBe("live");
});

it("does not fall back to removing merchant-authored sources", async () => {
  mocks.request.mockResolvedValueOnce({ collection: { sources: [{ id: "merchant", __typename: "CollectionConditionsSource", title: "Merchant selection", targetType: "PRODUCTS" }] } });
  await removeProductFromShopifyCollection({ shopifyCollectionId: "c1", shopifyManualSourceId: "stale" }, "p1");
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

it("deletes the emptied managed source when other sources remain instead of calling the legacy API", async () => {
  mocks.request.mockResolvedValueOnce({ collection: { sources: [
    { id: "ours", __typename: "CollectionConditionsSource", title: SHOPIFY_MANUAL_SOURCE_TITLE, targetType: "PRODUCTS" },
    { id: "merchant", __typename: "CollectionConditionsSource", title: "Merchant selection", targetType: "PRODUCTS" },
  ] } })
    .mockResolvedValueOnce({ collectionUpdate: { job: null, userErrors: [{ message: "A condition based source must have at least one product selection or condition" }] } })
    .mockResolvedValueOnce({ collectionUpdate: { job: null, userErrors: [] } });
  await removeProductFromShopifyCollection({ shopifyCollectionId: "c1", shopifyManualSourceId: "ours" }, "p1");
  expect(mocks.request.mock.calls[2][1]).toEqual({ collection: { id: "c1", sourcesToDelete: ["ours"] } });
  expect(mocks.request.mock.calls.every((call) => !call[0].includes("collectionRemoveProducts"))).toBe(true);
});
