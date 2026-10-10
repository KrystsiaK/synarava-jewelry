import { describe, expect, it } from "vitest";

import { projectPublicProductMetafields } from "@/lib/shopify/public-metafields";

describe("projectPublicProductMetafields", () => {
  it("shows public merchant facts without leaking private or opaque values", () => {
    expect(projectPublicProductMetafields([
      { namespace: "custom", key: "pearl_grade", type: "single_line_text_field", value: "AAA", definition: { name: "Pearl grade", access: { storefront: "PUBLIC_READ" } } },
      { namespace: "custom", key: "internal_note", type: "single_line_text_field", value: "private", definition: { name: "Internal note", access: { storefront: "NONE" } } },
      { namespace: "custom", key: "stone", type: "metaobject_reference", value: "gid://shopify/Metaobject/1", definition: { name: "Stone", access: { storefront: "PUBLIC_READ" } } },
      { namespace: "synarava", key: "material", type: "single_line_text_field", value: "Pearl", definition: { name: "Material", access: { storefront: "PUBLIC_READ" } } },
      { namespace: "custom", key: "made_to_order", type: "boolean", value: "false", definition: { name: "Made to order", access: { storefront: "PUBLIC_READ" } } },
      { namespace: "shopify", key: "color-pattern", type: "list.product_taxonomy_value_reference", value: "[\"gid://shopify/TaxonomyValue/1\"]", resolvedValues: ["White", "Gold"], definition: { name: "Color", access: { storefront: null } } },
      { namespace: "shopify", key: "fabric", type: "list.metaobject_reference", value: "[\"gid://shopify/Metaobject/9\"]", resolvedValues: ["Cotton"], definition: { name: "Fabric", access: { storefront: null } } },
    ])).toEqual([
      { label: "Pearl grade", value: "AAA" },
      { label: "Made to order", value: "No" },
      { label: "Color", value: "White, Gold" },
      { label: "Fabric", value: "Cotton" },
    ]);
  });

  it("prefers locale overlays for public text metafields", () => {
    expect(projectPublicProductMetafields(
      [
        {
          namespace: "custom",
          key: "care_instructions",
          type: "multi_line_text_field",
          value: "Keep dry.",
          definition: { name: "Care instructions", access: { storefront: "PUBLIC_READ" } },
        },
      ],
      {
        locale: "pt",
        snapshot: {
          metafieldTranslations: {
            pt: { "custom::care_instructions": "Manter seco." },
          },
        },
      },
    )).toEqual([{ label: "Care instructions", value: "Manter seco." }]);
  });

  it("uses pre-merged metafieldTranslations over a single working snapshot", () => {
    expect(projectPublicProductMetafields(
      [
        {
          namespace: "custom",
          key: "material",
          type: "single_line_text_field",
          value: "Pearl",
          definition: { name: "Material", access: { storefront: "PUBLIC_READ" } },
        },
      ],
      {
        locale: "ru",
        snapshot: {
          metafieldTranslations: {
            ru: { "custom::material": "Только working" },
          },
        },
        metafieldTranslations: {
          ru: {
            "custom::material": "Из merged Shopify+working",
          },
        },
      },
    )).toEqual([{ label: "Material", value: "Из merged Shopify+working" }]);
  });

  it("prefers Synarava passport TEXT overlays over EN Shopify category/public facts", () => {
    expect(projectPublicProductMetafields(
      [
        {
          namespace: "shopify",
          key: "material",
          type: "list.product_taxonomy_value_reference",
          value: "[\"gid://shopify/TaxonomyValue/1\"]",
          resolvedValues: ["Crystal pearl"],
          definition: { name: "Material", access: { storefront: null } },
        },
        {
          namespace: "custom",
          key: "wrist_fit",
          type: "single_line_text_field",
          value: "17 cm",
          definition: { name: "Wrist fit", access: { storefront: "PUBLIC_READ" } },
        },
      ],
      {
        locale: "ru",
        characteristicTextOverlay: {
          material: "Хрустальный жемчуг",
          fit_notes: "17 см",
        },
      },
    )).toEqual([
      { label: "Material", value: "Хрустальный жемчуг" },
      { label: "Wrist fit", value: "17 см" },
    ]);
  });
});
