import { describe, expect, it } from "vitest";

import { resolveCollectionsIndexCollections } from "@/lib/content/collections-index-section";

const collections = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gamma" },
];

describe("resolveCollectionsIndexCollections", () => {
  it("returns selected ids in configured order and skips missing ones", () => {
    expect(resolveCollectionsIndexCollections(collections, ["c", "missing", "a"]).map((c) => c.id)).toEqual([
      "c",
      "a",
    ]);
  });

  it("returns all collections in catalog order when nothing is selected", () => {
    expect(resolveCollectionsIndexCollections(collections, []).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(resolveCollectionsIndexCollections(collections, null).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(resolveCollectionsIndexCollections(collections, ["", "  "]).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("dedupes selected ids", () => {
    expect(resolveCollectionsIndexCollections(collections, ["b", "b", "a"]).map((c) => c.id)).toEqual([
      "b",
      "a",
    ]);
  });
});
