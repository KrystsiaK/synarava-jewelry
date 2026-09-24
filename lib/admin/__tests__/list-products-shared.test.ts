import { describe, expect, it } from "vitest";

import {
  clampAdminProductPageSize,
  listItemStatusLabel,
  normalizeAdminProductSort,
  ADMIN_PRODUCT_SORT_OPTIONS,
} from "@/lib/admin/list-products-shared";

describe("list-products-shared", () => {
  it("normalizes known and unknown sort keys", () => {
    expect(normalizeAdminProductSort("problems")).toBe("problems");
    expect(normalizeAdminProductSort("conflicts")).toBe("conflicts");
    expect(normalizeAdminProductSort("nope")).toBe("published");
  });

  it("includes problems and conflicts as first sort options", () => {
    expect(ADMIN_PRODUCT_SORT_OPTIONS.map((option) => option.value).slice(0, 2)).toEqual([
      "problems",
      "conflicts",
    ]);
  });

  it("clamps page size", () => {
    expect(clampAdminProductPageSize(null)).toBe(30);
    expect(clampAdminProductPageSize("12")).toBe(12);
    expect(clampAdminProductPageSize(999)).toBe(60);
  });

  it("maps workflow status labels", () => {
    expect(listItemStatusLabel({ status: "ACTIVE", visibility: "PUBLIC" })).toBe("PUBLISHED");
    expect(listItemStatusLabel({ status: "ACTIVE", visibility: "PRIVATE" })).toBe("DRAFT");
    expect(listItemStatusLabel({ status: "ARCHIVED", visibility: "PRIVATE" })).toBe("ARCHIVED");
    expect(listItemStatusLabel({ status: "UNLISTED", visibility: "UNLISTED" })).toBe("UNLISTED");
  });
});
