import {
  clearCatalogViewCacheForTests,
  getMemoryView,
  getPersistedView,
  saveView,
  type CatalogViewSnapshot,
} from "../catalog-view-cache";

function snapshot(overrides: Partial<CatalogViewSnapshot> = {}): CatalogViewSnapshot {
  return {
    viewKey: "en|",
    savedAt: Date.now(),
    nodes: [{ id: "a" } as CatalogViewSnapshot["nodes"][number]],
    endCursor: "cursor-1",
    hasNextPage: true,
    totalCount: 3,
    anchor: null,
    ...overrides,
  };
}

describe("catalog view cache", () => {
  beforeEach(() => {
    clearCatalogViewCacheForTests();
  });

  it("returns null for a view that was never saved", () => {
    expect(getMemoryView("missing")).toBeNull();
  });

  it("round-trips a saved view through the memory cache", () => {
    saveView(snapshot({ viewKey: "en|q=ring" }));
    expect(getMemoryView("en|q=ring")).toMatchObject({ endCursor: "cursor-1", hasNextPage: true });
  });

  it("treats an expired view as absent", () => {
    saveView(snapshot({ viewKey: "en|old", savedAt: Date.now() - 31 * 60 * 1000 }));
    expect(getMemoryView("en|old")).toBeNull();
  });

  it("treats a corrupt view (nodes missing ids) as absent", () => {
    saveView(snapshot({ viewKey: "en|corrupt", nodes: [{ notAnId: true } as unknown as CatalogViewSnapshot["nodes"][number]] }));
    expect(getMemoryView("en|corrupt")).toBeNull();
  });

  it("degrades to no-op when IndexedDB isn't available (jsdom has none)", async () => {
    await expect(getPersistedView("en|anything")).resolves.toBeNull();
    expect(() => saveView(snapshot({ viewKey: "en|write-through" }))).not.toThrow();
    // the memory half of the write-through still works even without IndexedDB
    expect(getMemoryView("en|write-through")).not.toBeNull();
  });
});
