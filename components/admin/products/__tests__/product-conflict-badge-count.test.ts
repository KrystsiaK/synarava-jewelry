import { describe, expect, it } from "vitest";

import { productConflictBadgeCount } from "@/components/admin/products/product-conflict-badge-count";

describe("productConflictBadgeCount", () => {
  it("counts shared commerce fields, not a boolean +1", () => {
    expect(
      productConflictBadgeCount(
        { shared: true, sharedCount: 2, locales: [] },
      ),
    ).toBe(2);
  });

  it("prefers live inspect commerceFieldCount over signal.sharedCount", () => {
    expect(
      productConflictBadgeCount(
        { shared: true, sharedCount: 1, locales: [] },
        { commerceFieldCount: 2 },
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

  it("uses commerceFieldCount alone when signals are empty but inspect found diffs", () => {
    expect(productConflictBadgeCount(null, { commerceFieldCount: 2 })).toBe(2);
  });
});
