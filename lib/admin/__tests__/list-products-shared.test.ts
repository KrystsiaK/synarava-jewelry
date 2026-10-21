import { describe, expect, it } from "vitest";

import {
  clampAdminProductPageSize,
  listItemStatusLabel,
  normalizeAdminProductSort,
  ADMIN_PRODUCT_SORT_OPTIONS,
} from "@/lib/admin/list-products-shared";

describe("list-products-shared", () => {
  it("normalizes known and unknown sort keys", () => {
    expect(normalizeAdminProductSort("conflicts")).toBe("conflicts");
    expect(normalizeAdminProductSort("problems")).toBe("published");
    expect(normalizeAdminProductSort("nope")).toBe("published");
  });

  it("includes conflicts as the first sort option", () => {
    expect(ADMIN_PRODUCT_SORT_OPTIONS.map((option) => option.value)[0]).toBe("conflicts");
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
