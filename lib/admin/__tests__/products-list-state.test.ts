import { describe, expect, it } from "vitest";

import {
  parseAdminProductsListState,
  toAdminProductListFilters,
} from "@/lib/admin/products-list-state";
import { listStateToSearchString } from "@/lib/list-state";
import { adminProductsListSchema } from "@/lib/admin/products-list-state";

describe("admin products list-state", () => {
  it("defaults match the previous hardcoded page sort", () => {
    expect(parseAdminProductsListState({})).toEqual({
      q: "",
      status: "ALL",
      category: "ALL",
      collection: "ALL",
      sort: "published",
    });
  });

  it("round-trips and drops invalid sort/status", () => {
    const state = parseAdminProductsListState({
      q: "gold",
      status: "DRAFT",
      category: "rings",
      collection: "c1",
      sort: "name-asc",
    });
    expect(listStateToSearchString(adminProductsListSchema, state)).toBe(
      "q=gold&status=DRAFT&category=rings&collection=c1&sort=name-asc",
    );
    expect(parseAdminProductsListState({ sort: "nope", status: "HACK" })).toEqual({
      q: "",
      status: "ALL",
      category: "ALL",
      collection: "ALL",
      sort: "published",
    });
  });

  it("maps to listAdminProductsPage filters without cursor", () => {
    expect(
      toAdminProductListFilters({
        q: "x",
        status: "PUBLISHED",
        category: "ALL",
        collection: "col-1",
        sort: "updated",
      }),
    ).toEqual({
      q: "x",
      status: "PUBLISHED",
      categoryId: undefined,
      collectionId: "col-1",
      sort: "updated",
    });
  });
});
