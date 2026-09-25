import { describe, expect, it } from "vitest";

import { extractShopifyProductFacts } from "@/lib/shopify/product-facts";

describe("extractShopifyProductFacts", () => {
  it("projects Shopify category attrs, custom metafields, weight, and origin — not empty passport groups", () => {
    expect(extractShopifyProductFacts({
      shopifyCategoryName: "Arts & Entertainment > … > Sewing Thread",
      vendor: "Synarava shop",
      productType: "Creative Thread Set",
      snapshot: {
        metafields: [
          {
            namespace: "shopify",
            key: "color-pattern",
            type: "list.metaobject_reference",
            value: "[\"gid://shopify/Metaobject/1\"]",
            resolvedValues: ["Blue", "Red", "White"],
            definition: { name: "Color", access: { storefront: "PUBLIC_READ" } },
          },
          {
            namespace: "custom",
            key: "material",
            type: "single_line_text_field",
            value: "100% cotton",
            definition: { name: "Material", access: { storefront: "PUBLIC_READ" } },
          },
          {
            namespace: "global",
            key: "title_tag",
            type: "string",
            value: "SEO",
            definition: null,
          },
        ],
        variants: [{
          inventoryItem: {
            countryCodeOfOrigin: "CN",
            measurement: { weight: { value: 37.9, unit: "GRAMS" } },
          },
        }],
      },
      characteristics: [
        {
          key: "unit_weight",
          label: "Unit weight",
          group: "Dimensions & fit",
          valueType: "NUMBER",
          textValue: null,
          numberValue: 37.9,
          booleanValue: null,
          unit: "g",
          certificateUrl: null,
          sortOrder: 0,
        },
      ],
    })).toEqual([
      { key: "category", label: "Category", value: "Arts & Entertainment > … > Sewing Thread" },
      { key: "vendor", label: "Vendor", value: "Synarava shop" },
      { key: "productType", label: "Product type", value: "Creative Thread Set" },
      { key: "category:color-pattern", label: "Color", value: "Blue, Red, White" },
      { key: "custom.material", label: "Material", value: "100% cotton" },
      { key: "weight", label: "Unit weight", value: "37.9 g" },
      { key: "origin", label: "Country of origin", value: "CN" },
    ]);
  });
});
