import { describe, expect, it } from "vitest";

import {
  SHOPIFY_MANUAL_SOURCE_TITLE,
  buildCollectionMembershipSourceCreateInput,
  buildCollectionMembershipUpdateInput,
  findManagedCollectionSourceId,
  hasCollectionIdentityConflict,
  waitForShopifyJobCompletion,
} from "@/lib/shopify/collection-membership";

describe("Shopify 2026-07 collection membership", () => {
  it("creates an app-owned product source for the first manual selection", () => {
    expect(buildCollectionMembershipSourceCreateInput({
      collectionId: "gid://shopify/Collection/1",
      productId: "gid://shopify/Product/2",
    })).toEqual({
      id: "gid://shopify/Collection/1",
      sourcesToCreate: [{
        source: {
          title: SHOPIFY_MANUAL_SOURCE_TITLE,
          targetType: "PRODUCTS",
          inclusion: {
            matchType: "ANY",
            selections: [{ productId: "gid://shopify/Product/2" }],
          },
        },
      }],
    });
  });

  it("adds and removes selections through the owned source", () => {
    expect(buildCollectionMembershipUpdateInput({
      collectionId: "gid://shopify/Collection/1",
      sourceId: "gid://shopify/CollectionConditionsSource/3",
      productId: "gid://shopify/Product/2",
      action: "ADD",
    })).toEqual({
      id: "gid://shopify/Collection/1",
      sourcesToUpdate: [{
        condition: {
          id: "gid://shopify/CollectionConditionsSource/3",
          inclusion: { selectionsToAdd: [{ productId: "gid://shopify/Product/2" }] },
        },
      }],
    });

    expect(buildCollectionMembershipUpdateInput({
      collectionId: "gid://shopify/Collection/1",
      sourceId: "gid://shopify/CollectionConditionsSource/3",
      productId: "gid://shopify/Product/2",
      action: "REMOVE",
    })).toEqual({
      id: "gid://shopify/Collection/1",
      sourcesToUpdate: [{
        condition: {
          id: "gid://shopify/CollectionConditionsSource/3",
          inclusion: { selectionsToRemove: [{ productId: "gid://shopify/Product/2" }] },
        },
      }],
    });
  });

  it("detects a slug collision instead of silently dropping membership", () => {
    expect(hasCollectionIdentityConflict("gid://shopify/Collection/1", "gid://shopify/Collection/2")).toBe(true);
    expect(hasCollectionIdentityConflict("gid://shopify/Collection/1", "gid://shopify/Collection/1")).toBe(false);
    expect(hasCollectionIdentityConflict(null, "gid://shopify/Collection/1")).toBe(false);
  });

  it("only reuses Synarava's product-scoped manual source", () => {
    expect(findManagedCollectionSourceId([
      { id: "wrong-title", __typename: "CollectionConditionsSource", title: "Imported rules", targetType: "PRODUCTS" },
      { id: "wrong-target", __typename: "CollectionConditionsSource", title: SHOPIFY_MANUAL_SOURCE_TITLE, targetType: "VARIANTS" },
      { id: "owned", __typename: "CollectionConditionsSource", title: SHOPIFY_MANUAL_SOURCE_TITLE, targetType: "PRODUCTS" },
    ])).toBe("owned");
  });

  it("preserves the stored source identity if its Shopify title changes", () => {
    expect(findManagedCollectionSourceId([
      { id: "stored", __typename: "CollectionConditionsSource", title: "Renamed in Shopify", targetType: "PRODUCTS" },
    ], "stored")).toBe("stored");
  });

  it("waits for an asynchronous collectionUpdate job before declaring sync complete", async () => {
    const states = [
      { id: "gid://shopify/Job/1", done: false },
      { id: "gid://shopify/Job/1", done: true },
    ];
    let reads = 0;

    await expect(waitForShopifyJobCompletion(
      { id: "gid://shopify/Job/1", done: false },
      async () => states[reads++] ?? null,
      [0, 0],
      async () => undefined,
    )).resolves.toBeUndefined();
    expect(reads).toBe(2);
  });
});
