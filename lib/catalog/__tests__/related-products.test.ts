import { describe, expect, it } from "vitest";

import { pickRelatedProducts } from "@/lib/catalog/related-products";

const product = { slug: "current", shopifyProductId: "gid://shopify/Product/1", categorySlug: "rings" };

function candidate(slug: string, shopifyProductId: string | null, categorySlug: string | null) {
  return { slug, shopifyProductId, categorySlug };
}

describe("pickRelatedProducts", () => {
  it("orders matches by Shopify's ranked related IDs", () => {
    const catalog = [
      candidate("a", "gid://shopify/Product/2", "rings"),
      candidate("b", "gid://shopify/Product/3", "bracelets"),
    ];

    expect(pickRelatedProducts(product, catalog, ["gid://shopify/Product/3", "gid://shopify/Product/2"]))
      .toEqual([catalog[1], catalog[0]]);
  });

  it("excludes the current product even if Shopify recommends it back", () => {
    const catalog = [product, candidate("a", "gid://shopify/Product/2", "rings")];

    expect(pickRelatedProducts(product, catalog, ["gid://shopify/Product/1", "gid://shopify/Product/2"]))
      .toEqual([catalog[1]]);
  });

  it("backfills with same-category products when Shopify has too few recommendations", () => {
    const catalog = [
      candidate("a", "gid://shopify/Product/2", "rings"),
      candidate("b", "gid://shopify/Product/3", "rings"),
      candidate("c", "gid://shopify/Product/4", "bracelets"),
    ];

    expect(pickRelatedProducts(product, catalog, [])).toEqual([catalog[0], catalog[1]]);
  });

  it("never duplicates a product already picked from Shopify's ranking", () => {
    const catalog = [candidate("a", "gid://shopify/Product/2", "rings")];

    expect(pickRelatedProducts(product, catalog, ["gid://shopify/Product/2"])).toEqual([catalog[0]]);
  });

  it("caps the result at the given limit", () => {
    const catalog = Array.from({ length: 10 }, (_, i) => candidate(`p${i}`, `gid://shopify/Product/${i + 2}`, "rings"));

    expect(pickRelatedProducts(product, catalog, [], 3)).toHaveLength(3);
  });
});
