import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";

/**
 * Audit #2: linked entity with null shopifySnapshot must not look clean —
 * emit uncheckedCount instead of skipping as no conflict.
 */

describe("compareSyncState unchecked commerce windows", () => {
  it("counts a linked window with null shopifySnapshot as unchecked, not a conflict leaf", () => {
    const result = compareSyncState({
      commerceWindows: [
        {
          resourceType: "COLLECTION",
          resourceId: "c1",
          workingSnapshot: { title: "Pets", handle: "pets" },
          shopifySnapshot: null,
        },
      ],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [],
      connected: true,
      checkedAt: "2026-10-25T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-25T12:01:00.000Z"),
    });

    expect(result.uncheckedCount).toBe(1);
    expect(result.leaves).toHaveLength(0);
    expect(result.state).toBe("ready");
  });

  it("still emits Adopt when Shopify window exists and Synarava working is null", () => {
    const result = compareSyncState({
      commerceWindows: [
        {
          resourceType: "PRODUCT",
          resourceId: "p1",
          workingSnapshot: null,
          shopifySnapshot: { title: "Remote" },
        },
      ],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [],
      connected: true,
      checkedAt: "2026-10-25T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-25T12:01:00.000Z"),
    });

    expect(result.uncheckedCount).toBe(0);
    expect(result.leaves.some((leaf) => leaf.fieldKey === "commerce:adopt-shopify")).toBe(true);
  });
});
