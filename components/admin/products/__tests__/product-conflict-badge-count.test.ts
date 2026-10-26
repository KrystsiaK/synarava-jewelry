import { describe, expect, it } from "vitest";

import { productConflictBadgeCount } from "@/lib/sync/badge-count";

describe("productConflictBadgeCount", () => {
  it("reads SyncResult leafCount when present", () => {
    expect(
      productConflictBadgeCount(
        { leafCount: 4 },
      ),
    ).toBe(4);
  });

  it("returns 0 when leafCount is missing — no legacy shared=+1 fallback", () => {
    expect(productConflictBadgeCount({ shared: true, locales: [] } as { leafCount?: number })).toBe(0);
    expect(productConflictBadgeCount({ leafCount: undefined })).toBe(0);
  });

  it("returns 0 for null signals", () => {
    expect(productConflictBadgeCount(null)).toBe(0);
  });

  it("floors negative / fractional leafCount", () => {
    expect(productConflictBadgeCount({ leafCount: 2.9 })).toBe(2);
    expect(productConflictBadgeCount({ leafCount: -3 })).toBe(0);
  });
});
