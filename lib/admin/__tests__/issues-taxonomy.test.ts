import { describe, expect, it } from "vitest";

import { productTaxonomyGaps } from "../product-taxonomy-gaps";

describe("productTaxonomyGaps", () => {
  it("requires a Shopify taxonomy category id, not the legacy ProductCategory relation", () => {
    expect(
      productTaxonomyGaps({
        shopifyCategoryId: null,
        tags: [{ id: "t1" }],
        collections: [{ collection: { isStorefrontDefault: false } }],
      }).missingCategory,
    ).toBe(true);

    expect(
      productTaxonomyGaps({
        shopifyCategoryId: "gid://shopify/TaxonomyCategory/aa-1-9",
        tags: [],
        collections: [],
      }).missingCategory,
    ).toBe(false);
  });

  it("treats storefront-default membership alone as still missing a marketing collection", () => {
    expect(
      productTaxonomyGaps({
        shopifyCategoryId: "gid://shopify/TaxonomyCategory/aa-1-9",
        tags: [{ id: "t1" }],
        collections: [{ collection: { isStorefrontDefault: true } }],
      }).missingCollection,
    ).toBe(true);

    expect(
      productTaxonomyGaps({
        shopifyCategoryId: "gid://shopify/TaxonomyCategory/aa-1-9",
        tags: [{ id: "t1" }],
        collections: [
          { collection: { isStorefrontDefault: true } },
          { collection: { isStorefrontDefault: false } },
        ],
      }).missingCollection,
    ).toBe(false);
  });
});
