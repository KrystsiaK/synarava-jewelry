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

  it("applies Synarava passport TEXT overlays on non-EN without requiring Shopify translation sync", () => {
    const facts = extractShopifyProductFacts({
      locale: "ru",
      shopifyCategoryName: "Jewelry > Necklaces",
      productType: "Beaded Necklace",
      characteristicTextOverlay: {
        material: "Хрустальный жемчуг",
        finish: "PVD золото 18K",
        care_instructions: "Избегайте длительного контакта с водой.",
        fit_notes: "17 см",
      },
      taxonomyOverlays: new Map([
        ["Necklaces", "Колье"],
        ["Beaded Necklace", "Бусы"],
      ]),
      snapshot: {
        metafields: [
          {
            namespace: "shopify",
            key: "material",
            type: "list.product_taxonomy_value_reference",
            value: "[\"gid://shopify/TaxonomyValue/1\"]",
            resolvedValues: ["Crystal pearl"],
            definition: { name: "Material" },
          },
          {
            namespace: "shopify",
            key: "finish",
            type: "list.product_taxonomy_value_reference",
            value: "[\"gid://shopify/TaxonomyValue/2\"]",
            resolvedValues: ["18K Gold PVD"],
            definition: { name: "Finish" },
          },
          {
            namespace: "custom",
            key: "care",
            type: "multi_line_text_field",
            value: "Avoid prolonged contact with water.",
            definition: { name: "Care", access: { storefront: "PUBLIC_READ" } },
          },
          {
            namespace: "custom",
            key: "wrist_fit",
            type: "single_line_text_field",
            value: "17 cm",
            definition: { name: "Wrist fit", access: { storefront: "PUBLIC_READ" } },
          },
        ],
      },
      characteristics: [
        {
          key: "material",
          label: "Primary material",
          group: "Materials & construction",
          valueType: "TEXT",
          textValue: "Crystal pearl",
          numberValue: null,
          booleanValue: null,
          unit: null,
          certificateUrl: null,
          sortOrder: 0,
        },
      ],
    });

    expect(facts.find((fact) => fact.key === "category")?.value).toBe("Jewelry > Колье");
    expect(facts.find((fact) => fact.key === "productType")?.value).toBe("Бусы");
    expect(facts.find((fact) => fact.key === "category:material")?.value).toBe("Хрустальный жемчуг");
    expect(facts.find((fact) => fact.key === "category:finish")?.value).toBe("PVD золото 18K");
    expect(facts.find((fact) => fact.key === "custom.care")?.value).toBe(
      "Избегайте длительного контакта с водой.",
    );
    expect(facts.find((fact) => fact.key === "custom.wrist_fit")?.value).toBe("17 см");
  });
});
