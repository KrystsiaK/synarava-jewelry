import { describe, expect, it } from "vitest";

import { resolveHomeArchiveCollections } from "@/lib/content/home-archive-section";

const collections = [
  { id: "old", createdAt: "2024-01-01T00:00:00.000Z", name: "Old" },
  { id: "mid", createdAt: "2024-06-01T00:00:00.000Z", name: "Mid" },
  { id: "new", createdAt: "2025-01-01T00:00:00.000Z", name: "New" },
];

describe("resolveHomeArchiveCollections", () => {
  it("returns selected ids in order and skips missing ones", () => {
    expect(resolveHomeArchiveCollections(collections, ["mid", "missing", "old"]).map((c) => c.id)).toEqual([
      "mid",
      "old",
    ]);
  });

  it("defaults to the newest collection when nothing is selected", () => {
    expect(resolveHomeArchiveCollections(collections, []).map((c) => c.id)).toEqual(["new"]);
    expect(resolveHomeArchiveCollections(collections, null).map((c) => c.id)).toEqual(["new"]);
    expect(resolveHomeArchiveCollections(collections, ["", "  "]).map((c) => c.id)).toEqual(["new"]);
  });

  it("dedupes selected ids", () => {
    expect(resolveHomeArchiveCollections(collections, ["old", "old", "mid"]).map((c) => c.id)).toEqual([
      "old",
      "mid",
    ]);
  });
});
