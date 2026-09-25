import { describe, expect, it } from "vitest";

import {
  characteristicKeyForShopifyCategoryMetafield,
  displayNamesFromCategoryReference,
  extractSelectedShopifyCategoryAttributes,
  extractSimpleTextCharacteristicSeeds,
  isShopifyCategoryMetafieldType,
} from "@/lib/shopify/category-attribute-values";

describe("isShopifyCategoryMetafieldType", () => {
  it("accepts taxonomy-value and metaobject reference types", () => {
    expect(isShopifyCategoryMetafieldType("list.product_taxonomy_value_reference")).toBe(true);
    expect(isShopifyCategoryMetafieldType("product_taxonomy_value_reference")).toBe(true);
    expect(isShopifyCategoryMetafieldType("list.metaobject_reference")).toBe(true);
    expect(isShopifyCategoryMetafieldType("metaobject_reference")).toBe(true);
    expect(isShopifyCategoryMetafieldType("single_line_text_field")).toBe(false);
  });
});

describe("extractSelectedShopifyCategoryAttributes", () => {
  it("returns resolved selections and ignores vocabulary-only or empty refs", () => {
    expect(extractSelectedShopifyCategoryAttributes({
      metafields: [
        {
          namespace: "shopify",
          key: "color-pattern",
          type: "list.metaobject_reference",
          value: "[\"gid://shopify/Metaobject/1\"]",
          resolvedValues: ["Multicolor"],
          definition: { name: "Color" },
        },
        {
          namespace: "shopify",
          key: "fabric",
          type: "list.product_taxonomy_value_reference",
          value: "[\"gid://shopify/TaxonomyValue/1\"]",
          resolvedValues: ["Cotton"],
          definition: { name: "Fabric" },
        },
        {
          namespace: "shopify",
          key: "pattern",
          type: "list.metaobject_reference",
          value: "[]",
          resolvedValues: [],
          definition: { name: "Pattern" },
        },
        {
          namespace: "synarava",
          key: "material",
          type: "single_line_text_field",
          value: "Pearl",
          definition: { name: "Material" },
        },
      ],
    })).toEqual([
      { key: "color-pattern", label: "Color", values: ["Multicolor"] },
      { key: "fabric", label: "Fabric", values: ["Cotton"] },
    ]);
  });
});

describe("characteristicKeyForShopifyCategoryMetafield", () => {
  it("maps known Shopify category keys and labels onto passport fields", () => {
    expect(characteristicKeyForShopifyCategoryMetafield("color-pattern", "Color")).toBe("color");
    expect(characteristicKeyForShopifyCategoryMetafield("fabric", "Fabric")).toBe("material");
    expect(characteristicKeyForShopifyCategoryMetafield("material", "Material")).toBe("material");
    expect(characteristicKeyForShopifyCategoryMetafield("unknown-attr", "Dye technique")).toBeNull();
  });
});

describe("extractSimpleTextCharacteristicSeeds", () => {
  it("seeds custom text metafields that map onto passport keys", () => {
    expect(extractSimpleTextCharacteristicSeeds([
      {
        namespace: "custom",
        key: "material",
        type: "single_line_text_field",
        value: "100% cotton",
        definition: { name: "Material" },
      },
      {
        namespace: "global",
        key: "title_tag",
        type: "string",
        value: "SEO title",
        definition: null,
      },
      {
        namespace: "synarava",
        key: "color",
        type: "single_line_text_field",
        value: "ignored — applied separately",
        definition: { name: "Color" },
      },
      {
        namespace: "shopify",
        key: "color-pattern",
        type: "list.metaobject_reference",
        value: "[\"gid://shopify/Metaobject/1\"]",
        definition: { name: "Color" },
      },
    ])).toEqual([
      { characteristicKey: "material", textValue: "100% cotton" },
    ]);
  });
});

describe("displayNamesFromCategoryReference", () => {
  it("prefers TaxonomyValue name, then metaobject displayName, then label field", () => {
    expect(displayNamesFromCategoryReference({ name: "Black" })).toEqual(["Black"]);
    expect(displayNamesFromCategoryReference({ displayName: "Cotton / Solid" })).toEqual(["Cotton / Solid"]);
    expect(displayNamesFromCategoryReference({
      fields: [{ key: "label", value: "Hand-dyed" }],
    })).toEqual(["Hand-dyed"]);
    expect(displayNamesFromCategoryReference({})).toEqual([]);
  });
});
