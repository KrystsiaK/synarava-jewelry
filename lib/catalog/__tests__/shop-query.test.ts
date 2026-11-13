import { describe, expect, it } from "vitest";
import {
  clampPageSize,
  decodeCatalogCursor,
  encodeCatalogCursor,
  resolveShopCatalogPageSize,
} from "../shop-query";

describe("catalog cursor", () => {
  it("round-trips to the id it was minted for", () => {
    const cursor = encodeCatalogCursor({ sort: "newest" }, "en", "product-1");
    expect(decodeCatalogCursor(cursor, { sort: "newest" }, "en")).toBe("product-1");
  });

  it("rejects a cursor minted for a different filter/sort combination", () => {
    const cursor = encodeCatalogCursor({ sort: "newest" }, "en", "product-1");
    expect(decodeCatalogCursor(cursor, { sort: "price-asc" }, "en")).toBeNull();
  });

  it("rejects a cursor minted for a different locale", () => {
    const cursor = encodeCatalogCursor({ sort: "newest" }, "en", "product-1");
    expect(decodeCatalogCursor(cursor, { sort: "newest" }, "pt")).toBeNull();
  });

  it("treats missing or malformed cursors as no cursor", () => {
    expect(decodeCatalogCursor(null, {}, "en")).toBeNull();
    expect(decodeCatalogCursor("not-base64-json", {}, "en")).toBeNull();
  });
});

describe("clampPageSize", () => {
  it("falls back to the default for missing or invalid values", () => {
    expect(clampPageSize(null)).toBe(24);
    expect(clampPageSize("not-a-number")).toBe(24);
    expect(clampPageSize("-5")).toBe(24);
  });

  it("caps oversized requests at the max page size", () => {
    expect(clampPageSize("500")).toBe(48);
  });

  it("passes through a valid in-range size", () => {
    expect(clampPageSize("12")).toBe(12);
  });
});

describe("resolveShopCatalogPageSize", () => {
  it("defaults to 24 and honors SHOP_CATALOG_PAGE_SIZE", () => {
    expect(resolveShopCatalogPageSize({})).toBe(24);
    expect(resolveShopCatalogPageSize({ SHOP_CATALOG_PAGE_SIZE: "2" })).toBe(2);
    expect(resolveShopCatalogPageSize({ SHOP_CATALOG_PAGE_SIZE: "99" })).toBe(48);
  });
});
