import { describe, expect, it } from "vitest";

import { normalizeShopSort } from "@/lib/catalog/shop-sort";
import { buildSearchParams, countActiveFilters, filtersWithoutSort } from "../types";

describe("shop query state", () => {
  it("keeps non-default sorting in the URL", () => {
    expect(buildSearchParams({ department: "jewelry", sort: "price-desc" }))
      .toBe("department=jewelry&sort=price-desc");
  });

  it("omits the default sort from the URL", () => {
    expect(buildSearchParams({ sort: "featured" })).toBe("");
  });

  it("does not count sorting as an active filter", () => {
    expect(countActiveFilters({ category: "necklaces", sort: "newest" })).toBe(1);
  });

  it("preserves sorting when filters are cleared", () => {
    expect(filtersWithoutSort({ q: "pearl", material: "silver", sort: "price-asc" }))
      .toEqual({ sort: "price-asc" });
  });

  it("normalizes unknown sort values", () => {
    expect(normalizeShopSort("unexpected")).toBe("featured");
  });
});
