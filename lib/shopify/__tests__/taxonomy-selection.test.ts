import { describe, expect, it } from "vitest";

import {
  parseShopifyTaxonomySelection,
  shopifyProductCategoryInput,
} from "@/lib/shopify/taxonomy-selection";

describe("parseShopifyTaxonomySelection", () => {
  it("accepts a complete Shopify taxonomy selection", () => {
    expect(parseShopifyTaxonomySelection({
      id: "gid://shopify/TaxonomyCategory/aa-1-9",
      name: "Apparel & Accessories > Jewelry > Rings",
    })).toEqual({
      id: "gid://shopify/TaxonomyCategory/aa-1-9",
      name: "Apparel & Accessories > Jewelry > Rings",
    });
  });

  it("treats two empty values as a cleared selection", () => {
    expect(parseShopifyTaxonomySelection({ id: "", name: "" })).toBeNull();
  });

  it("rejects partial or non-Shopify selections", () => {
    expect(() => parseShopifyTaxonomySelection({ id: "not-a-gid", name: "Rings" })).toThrow(
      "Choose a category from Shopify taxonomy results",
    );
    expect(() => parseShopifyTaxonomySelection({ id: "", name: "Rings" })).toThrow(
      "Choose a category from Shopify taxonomy results",
    );
  });
});

describe("shopifyProductCategoryInput", () => {
  it("sends the category GID and sends null when the selection is cleared", () => {
    expect(shopifyProductCategoryInput("gid://shopify/TaxonomyCategory/aa-1-9")).toEqual({
      category: "gid://shopify/TaxonomyCategory/aa-1-9",
    });
    expect(shopifyProductCategoryInput(null)).toEqual({ category: null });
  });
});
