import {
  buildCatalogViewKey,
  CATALOG_VIEW_SCHEMA_VERSION,
  clearCatalogViewCacheForTests,
  fingerprintFromViewKey,
  getMemoryView,
  getPersistedView,
  isOwnedCatalogView,
  saveView,
  type CatalogViewSnapshot,
} from "../catalog-view-cache";

function snapshot(overrides: Partial<CatalogViewSnapshot> = {}): CatalogViewSnapshot {
  const viewKey = overrides.viewKey ?? "en|";
  const fingerprint = overrides.fingerprint ?? fingerprintFromViewKey(viewKey);
  return {
    schemaVersion: CATALOG_VIEW_SCHEMA_VERSION,
    savedAt: Date.now(),
    nodes: [{ id: "a" } as CatalogViewSnapshot["nodes"][number]],
    endCursor: "cursor-1",
    hasNextPage: true,
    totalCount: 3,
    anchor: null,
    ...overrides,
    viewKey,
    fingerprint,
  };
}

describe("catalog view cache", () => {
  beforeEach(() => {
    clearCatalogViewCacheForTests();
  });

  it("returns null for a view that was never saved", () => {
    expect(getMemoryView("missing", "")).toBeNull();
  });

  it("round-trips a saved view through the memory cache", () => {
    const fp = "q=ring";
    const viewKey = buildCatalogViewKey("en", fp);
    expect(saveView(snapshot({ viewKey, fingerprint: fp }))).toBe(true);
    expect(getMemoryView(viewKey, fp)).toMatchObject({ endCursor: "cursor-1", hasNextPage: true });
  });

  it("treats an expired view as absent (TTL)", () => {
    const fp = "old";
    const viewKey = buildCatalogViewKey("en", fp);
    saveView(snapshot({ viewKey, fingerprint: fp, savedAt: Date.now() - 31 * 60 * 1000 }));
    expect(getMemoryView(viewKey, fp)).toBeNull();
  });

  it("treats a corrupt view (nodes missing ids) as absent", () => {
    const fp = "corrupt";
    const viewKey = buildCatalogViewKey("en", fp);
    // Bypass saveView gate by writing through a crafted owned-looking call that
    // still fails hasValidNodes — saveView itself must reject.
    expect(
      saveView(
        snapshot({
          viewKey,
          fingerprint: fp,
          nodes: [{ notAnId: true } as unknown as CatalogViewSnapshot["nodes"][number]],
        }),
      ),
    ).toBe(false);
    expect(getMemoryView(viewKey, fp)).toBeNull();
  });

  it("degrades to no-op when IndexedDB isn't available (jsdom has none)", async () => {
    const fp = "write-through";
    const viewKey = buildCatalogViewKey("en", fp);
    await expect(getPersistedView(viewKey, fp)).resolves.toBeNull();
    expect(() => saveView(snapshot({ viewKey, fingerprint: fp }))).not.toThrow();
    expect(getMemoryView(viewKey, fp)).not.toBeNull();
  });

  describe("ownership invariant", () => {
    it("rejects write when fingerprint does not own the viewKey", () => {
      const written = saveView(
        snapshot({
          viewKey: buildCatalogViewKey("en", "productType=Ring"),
          fingerprint: "", // unfiltered nodes claiming the Ring key
        }),
      );
      expect(written).toBe(false);
      expect(getMemoryView(buildCatalogViewKey("en", "productType=Ring"), "productType=Ring")).toBeNull();
    });

    it("rejects read of a snapshot with a foreign fingerprint (hostile)", () => {
      // Simulate a pre-gate / corrupted memory entry that somehow landed under
      // the Ring key while carrying unfiltered ownership metadata.
      const poison = {
        viewKey: buildCatalogViewKey("en", "productType=Ring"),
        fingerprint: "",
        schemaVersion: CATALOG_VIEW_SCHEMA_VERSION,
        savedAt: Date.now(),
        nodes: [
          { id: "unfiltered-1" } as CatalogViewSnapshot["nodes"][number],
          { id: "unfiltered-2" } as CatalogViewSnapshot["nodes"][number],
        ],
        endCursor: null,
        hasNextPage: false,
        totalCount: 59,
        anchor: null,
      } satisfies CatalogViewSnapshot;

      expect(isOwnedCatalogView(poison, poison.viewKey, "productType=Ring")).toBe(false);
      // Even if we force the Map (tests only), getMemoryView must refuse it.
      clearCatalogViewCacheForTests();
      // saveView is the only public write — and it refuses.
      expect(saveView(poison)).toBe(false);
      expect(getMemoryView(poison.viewKey, "productType=Ring")).toBeNull();
    });

    it("rejects stale schema versions so pre-v2 rows cannot restore", () => {
      const fp = "productType=Ring";
      const viewKey = buildCatalogViewKey("en", fp);
      const v1 = {
        ...snapshot({ viewKey, fingerprint: fp }),
        schemaVersion: 1,
      };
      expect(saveView(v1)).toBe(false);
      expect(isOwnedCatalogView(v1, viewKey, fp)).toBe(false);
    });

    it("guard: no public write path can store nodes under a foreign key", () => {
      // The race that bit production: scroll persist with NEW viewKey + OLD nodes.
      // saveView is the sole write API — it must refuse that shape.
      const oldFp = "";
      const newFp = "productType=Ring";
      const attempted = snapshot({
        viewKey: buildCatalogViewKey("en", newFp),
        fingerprint: oldFp,
        nodes: Array.from({ length: 59 }, (_, i) => ({
          id: `old-${i}`,
        })) as CatalogViewSnapshot["nodes"],
        totalCount: 59,
      });
      expect(saveView(attempted)).toBe(false);
      expect(getMemoryView(buildCatalogViewKey("en", newFp), newFp)).toBeNull();
      // A later legitimate write for Ring must still succeed.
      expect(
        saveView(
          snapshot({
            viewKey: buildCatalogViewKey("en", newFp),
            fingerprint: newFp,
            nodes: [{ id: "ring-1" }, { id: "ring-2" }] as CatalogViewSnapshot["nodes"],
            totalCount: 2,
            hasNextPage: false,
            endCursor: null,
          }),
        ),
      ).toBe(true);
      expect(getMemoryView(buildCatalogViewKey("en", newFp), newFp)?.nodes).toHaveLength(2);
    });
  });

  describe("hostile sequences", () => {
    it("filter change → scroll-persist before list apply → reload cannot revive poison", async () => {
      const allFp = "";
      const ringFp = "productType=Ring";
      const allKey = buildCatalogViewKey("en", allFp);
      const ringKey = buildCatalogViewKey("en", ringFp);

      // User was on the unfiltered list.
      saveView(
        snapshot({
          viewKey: allKey,
          fingerprint: allFp,
          nodes: Array.from({ length: 59 }, (_, i) => ({ id: `p${i}` })) as CatalogViewSnapshot["nodes"],
          totalCount: 59,
        }),
      );

      // Race: scroll/cleanup tries to persist 59 nodes under the Ring key.
      expect(
        saveView(
          snapshot({
            viewKey: ringKey,
            fingerprint: allFp, // still showing unfiltered nodes
            nodes: Array.from({ length: 59 }, (_, i) => ({ id: `p${i}` })) as CatalogViewSnapshot["nodes"],
            totalCount: 59,
          }),
        ),
      ).toBe(false);

      // Reload / direct link for Ring must miss and not apply 59.
      expect(getMemoryView(ringKey, ringFp)).toBeNull();
      await expect(getPersistedView(ringKey, ringFp)).resolves.toBeNull();
    });

    it("back/forward across a filter chain restores only matching owned snapshots", () => {
      const chain = ["", "productType=Ring", "productType=Ring&sort=newest", ""] as const;
      for (const fp of chain) {
        const key = buildCatalogViewKey("en", fp);
        saveView(
          snapshot({
            viewKey: key,
            fingerprint: fp,
            nodes: [{ id: `node-${fp || "all"}` }] as CatalogViewSnapshot["nodes"],
            totalCount: 1,
            hasNextPage: false,
            endCursor: null,
          }),
        );
      }

      for (const fp of chain) {
        const hit = getMemoryView(buildCatalogViewKey("en", fp), fp);
        expect(hit?.fingerprint).toBe(fp);
        expect(hit?.nodes[0]?.id).toBe(`node-${fp || "all"}`);
      }
    });

    it("read with mismatched expected fingerprint refuses a otherwise-valid snapshot", () => {
      const fp = "productType=Ring";
      const key = buildCatalogViewKey("en", fp);
      saveView(snapshot({ viewKey: key, fingerprint: fp }));
      expect(getMemoryView(key, "")).toBeNull();
      expect(getMemoryView(key, fp)).not.toBeNull();
    });
  });
});
