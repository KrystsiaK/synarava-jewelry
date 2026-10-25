import { describe, expect, it } from "vitest";

import { productConflictBadgeCount } from "@/lib/sync/badge-count";

describe("productConflictBadgeCount", () => {
  it("prefers SyncResult leafCount when present", () => {
    expect(
      productConflictBadgeCount(
        { leafCount: 4, shared: true, sharedCount: 1, locales: [{ count: 9 }] },
      ),
    ).toBe(4);
  });

  it("counts shared commerce fields, not a boolean +1", () => {
    expect(
      productConflictBadgeCount(
        { shared: true, sharedCount: 2, locales: [] },
      ),
    ).toBe(2);
  });

  it("falls back to 1 for legacy shared=true without a field count", () => {
    expect(
      productConflictBadgeCount({ shared: true, locales: [] }),
    ).toBe(1);
  });

  it("adds locale translation conflicts on top of commerce fields", () => {
    expect(
      productConflictBadgeCount(
        {
          shared: true,
          sharedCount: 2,
          locales: [
            { count: 1 },
            { count: 2 },
          ],
        },
      ),
    ).toBe(5);
  });

  it("counts presence as one unit without inventing a shared field", () => {
    expect(
      productConflictBadgeCount({
        shared: true,
        sharedCount: 0,
        presence: "SHOPIFY_ONLY",
        locales: [],
      }),
    ).toBe(1);
  });

  it("returns 0 for null signals", () => {
    expect(productConflictBadgeCount(null)).toBe(0);
  });
});
