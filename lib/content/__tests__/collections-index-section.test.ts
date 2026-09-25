import { describe, expect, it } from "vitest";

import { resolveCollectionsIndexCollections } from "@/lib/content/collections-index-section";

const collections = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gamma" },
];

describe("resolveCollectionsIndexCollections", () => {
  it("returns all collections with selected ids first in configured order", () => {
    expect(resolveCollectionsIndexCollections(collections, ["c", "missing", "a"]).map((c) => c.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("returns all collections in catalog order when nothing is selected", () => {
    expect(resolveCollectionsIndexCollections(collections, []).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(resolveCollectionsIndexCollections(collections, null).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(resolveCollectionsIndexCollections(collections, ["", "  "]).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("dedupes selected ids and still appends the rest", () => {
    expect(resolveCollectionsIndexCollections(collections, ["b", "b", "a"]).map((c) => c.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
});
