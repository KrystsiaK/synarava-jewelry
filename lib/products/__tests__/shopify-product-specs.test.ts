import { describe, expect, it } from "vitest";

import {
  characteristicProjectionsFromShopifySpecs,
  isShopifyOwnedCharacteristicKey,
  isShopifyProductSpecFormField,
  SHOPIFY_OWNED_CHARACTERISTIC_KEYS,
  SHOPIFY_PRODUCT_SPEC_FIELDS,
  shopifyProductSpecKeysMissingInShopify,
  shopifyProductSpecValuesFromSnapshot,
  shopifyProductSpecValuesFromWindows,
} from "@/lib/products/shopify-product-specs";

describe("shopify product specs ownership", () => {
  it("lists Shopify-owned characteristic keys that must leave Passport UI", () => {
    expect(SHOPIFY_OWNED_CHARACTERISTIC_KEYS).toEqual(expect.arrayContaining([
      "material",
      "care_instructions",
      "finish",
      "fit_notes",
      "color",
      "metal",
      "stone_type",
      "plating",
      "size",
      "origin",
    ]));
    expect(isShopifyOwnedCharacteristicKey("material")).toBe(true);
    expect(isShopifyOwnedCharacteristicKey("reach_certified")).toBe(false);
    expect(isShopifyOwnedCharacteristicKey("chain_length")).toBe(false);
  });

  it("exposes Product-tab custom.* fields for jewelry specs", () => {
    const keys = SHOPIFY_PRODUCT_SPEC_FIELDS.map((item) => item.key);
    expect(keys).toEqual(expect.arrayContaining([
      "material",
      "care_instructions",
      "finish",
      "wrist_fit",
      "color",
      "metal",
      "stone",
      "plating",
      "size",
    ]));
    expect(isShopifyProductSpecFormField("customMetafieldValue:custom:material", "en")).toBe(true);
    expect(isShopifyProductSpecFormField("ptCustomMetafieldValue:custom:finish", "pt")).toBe(true);
    expect(isShopifyProductSpecFormField("customMetafieldValue:custom:warranty", "en")).toBe(false);
  });

  it("reads spec values from a commerce snapshot", () => {
    expect(shopifyProductSpecValuesFromSnapshot({
      metafields: [
        { namespace: "custom", key: "material", type: "single_line_text_field", value: "Pearl" },
        { namespace: "custom", key: "finish", type: "single_line_text_field", value: "PVD gold" },
        { namespace: "custom", key: "other", type: "single_line_text_field", value: "x" },
      ],
    })).toMatchObject({
      material: "Pearl",
      finish: "PVD gold",
      care_instructions: "",
    });
  });

  it("falls back to Shopify pull when OUR extras has no metafields (Golden Wheat shape)", () => {
    const shopifySnapshot = {
      metafields: [
        { namespace: "custom", key: "finish", type: "single_line_text_field", value: "18K Gold PVD" },
        { namespace: "custom", key: "wrist_fit", type: "single_line_text_field", value: "16–18 cm" },
        { namespace: "custom", key: "color", type: "single_line_text_field", value: "Gold" },
        { namespace: "custom", key: "metal", type: "single_line_text_field", value: "316L steel" },
        { namespace: "custom", key: "stone", type: "single_line_text_field", value: "None" },
        { namespace: "custom", key: "plating", type: "single_line_text_field", value: "18K Gold PVD" },
        { namespace: "custom", key: "size", type: "single_line_text_field", value: "One size" },
      ],
    };
    expect(shopifyProductSpecValuesFromWindows(
      { metafieldTranslations: { pt: { "custom::finish": "Acabamento" } } },
      shopifySnapshot,
    )).toMatchObject({
      finish: "18K Gold PVD",
      wrist_fit: "16–18 cm",
      color: "Gold",
      metal: "316L steel",
      stone: "None",
      plating: "18K Gold PVD",
      size: "One size",
    });
    expect(shopifyProductSpecKeysMissingInShopify(shopifySnapshot)).not.toContain("finish");
    expect(shopifyProductSpecKeysMissingInShopify({})).toEqual(
      expect.arrayContaining(["finish", "wrist_fit", "color", "metal", "stone", "plating", "size"]),
    );
  });

  it("projects custom.* specs into ProductCharacteristic rows for PDP", () => {
    const rows = characteristicProjectionsFromShopifySpecs([
      { key: "material", value: "316L steel" },
      { key: "wrist_fit", value: "18–21 cm" },
      { key: "finish", value: "" },
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ key: "material", textValue: "316L steel", valueType: "TEXT" }),
      expect.objectContaining({ key: "fit_notes", textValue: "18–21 cm", valueType: "TEXT" }),
    ]);
  });
});
