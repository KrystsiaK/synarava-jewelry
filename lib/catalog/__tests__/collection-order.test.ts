import { describe, expect, it } from "vitest";

import { moveCollectionItem, productCollectionPosition, syncedOrderPosition } from "../collection-order";

describe("collection ordering", () => {
  it("moves one item while preserving the relative order of the others", () => {
    expect(moveCollectionItem(["a", "b", "c", "d"], "d", 1)).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  it("clamps a requested position to the collection bounds", () => {
    expect(moveCollectionItem(["a", "b", "c"], "a", 99)).toEqual(["b", "c", "a"]);
    expect(moveCollectionItem(["a", "b", "c"], "c", -2)).toEqual(["c", "a", "b"]);
  });

  it("reads the priority belonging to the selected collection", () => {
    const product = {
      collections: [
        { sortOrder: 8, collection: { id: "other" } },
        { sortOrder: 2, collection: { id: "selected" } },
      ],
    };

    expect(productCollectionPosition(product, "selected")).toBe(2);
    expect(productCollectionPosition(product, "missing")).toBe(Number.POSITIVE_INFINITY);
  });

  it("indexes Shopify's reorder position only over products actually synced to Shopify", () => {
    const synced = new Set(["a", "b", "c"]);
    // "u" is a local-only product interleaved between synced ones and must not shift Shopify's index space.
    expect(syncedOrderPosition(["a", "u", "b", "c"], synced, "c")).toBe(2);
    expect(syncedOrderPosition(["u", "a", "b", "c"], synced, "a")).toBe(0);
  });
});
