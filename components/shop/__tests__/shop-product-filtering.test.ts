import { describe, expect, it } from "vitest";

import type { ProductSummary } from "@/lib/content/catalog";
import { filterAndSortShopProducts } from "../shop-product-filtering";

function product(overrides: Partial<ProductSummary>): ProductSummary {
  return {
    slug: "product",
    sku: "SKU",
    title: "Product",
    shortDescription: "",
    description: "",
    priceAmount: 100,
    stockOnHand: 1,
    inStock: true,
    searchText: "product sku",
    departmentSlug: "jewelry",
    categorySlug: "gid://shopify/TaxonomyCategory/aa-1",
    categoryName: "Bracelets",
    collectionSlug: "heritage",
    collectionSlugs: ["heritage"],
    tagSlugs: [],
    tagNames: [],
    characteristics: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as ProductSummary;
}

describe("filterAndSortShopProducts", () => {
  const products = [
    product({ slug: "older", title: "Heritage bracelet", createdAt: new Date("2025-01-01T00:00:00Z") }),
    product({ slug: "newer", title: "Silver necklace", categorySlug: "gid://shopify/TaxonomyCategory/aa-2", categoryName: "Necklaces", collectionSlugs: ["night"], createdAt: new Date("2026-08-01T00:00:00Z") }),
  ];

  it("matches the exact Shopify taxonomy category id", () => {
    expect(filterAndSortShopProducts(products, { category: "gid://shopify/TaxonomyCategory/aa-2" }, [], "en")
      .map((item) => item.slug)).toEqual(["newer"]);
  });

  it("matches every collection membership instead of only the lead collection", () => {
    expect(filterAndSortShopProducts(products, { collection: "night" }, [], "en")
      .map((item) => item.slug)).toEqual(["newer"]);
  });

  it("only treats stock on active variants as available", () => {
    const unavailable = product({ slug: "inactive-stock", stockOnHand: 5, inStock: false });
    expect(filterAndSortShopProducts([unavailable], { availability: "in-stock" }, [], "en"))
      .toEqual([]);
  });

  it("uses the complete server-derived search document", () => {
    const searchable = product({ slug: "hidden-handle", searchText: "hidden-handle archival phrase" });
    expect(filterAndSortShopProducts([searchable], { q: "archival phrase" }, [], "en"))
      .toEqual([searchable]);
  });

  it("sorts newest locally without a server navigation", () => {
    expect(filterAndSortShopProducts(products, { sort: "newest" }, [], "en")
      .map((item) => item.slug)).toEqual(["newer", "older"]);
  });

  it("uses the Shopify best-selling order for popular sorting", () => {
    expect(filterAndSortShopProducts(products, { sort: "popular" }, ["newer", "older"], "en")
      .map((item) => item.slug)).toEqual(["newer", "older"]);
  });
});
