import { describe, expect, it } from "vitest";

import {
  customMetafieldValueFieldName,
  customMetafieldsFromWorkingSnapshot,
  isManagedProductMetafieldNamespace,
  isTranslatableMetafieldType,
  listCustomProductMetafieldDefinitions,
  mergeCustomMetafieldsIntoList,
  characteristicOverlayFromMetafieldTranslations,
  mergeCharacteristicDisplayOverlay,
  mergeMetafieldTranslations,
  metafieldTranslationsFromSnapshot,
  metafieldValueFromSnapshot,
  parseCustomMetafieldTranslationsForm,
  parseCustomMetafieldsForm,
  slugifyMetafieldKey,
  type ProductMetafieldDefinition,
} from "@/lib/shopify/product-metafields-shared";

describe("product-metafields-shared", () => {
  it("treats synarava / shopify / global as managed namespaces", () => {
    expect(isManagedProductMetafieldNamespace("synarava")).toBe(true);
    expect(isManagedProductMetafieldNamespace("shopify")).toBe(true);
    expect(isManagedProductMetafieldNamespace("global")).toBe(true);
    expect(isManagedProductMetafieldNamespace("custom")).toBe(false);
    expect(isManagedProductMetafieldNamespace("warranty")).toBe(false);
  });

  it("lists only merchant-owned definitions sorted by name", () => {
    const definitions: ProductMetafieldDefinition[] = [
      { id: "1", namespace: "synarava", key: "material", name: "Material", type: "single_line_text_field", description: null },
      { id: "2", namespace: "custom", key: "warranty", name: "Warranty", type: "single_line_text_field", description: null },
      { id: "3", namespace: "custom", key: "care_kit", name: "Care kit", type: "multi_line_text_field", description: null },
      { id: "4", namespace: "shopify", key: "color-pattern", name: "Color", type: "list.metaobject_reference", description: null },
    ];
    expect(listCustomProductMetafieldDefinitions(definitions).map((item) => item.key)).toEqual([
      "care_kit",
      "warranty",
    ]);
  });

  it("slugifies definition keys from names", () => {
    expect(slugifyMetafieldKey("Warranty Info")).toBe("warranty_info");
    expect(slugifyMetafieldKey("  ")).toBe("custom_field");
  });

  it("reads values from a snapshot metafield list", () => {
    expect(metafieldValueFromSnapshot([
      { namespace: "custom", key: "warranty", value: "2 years", type: "single_line_text_field" },
    ], "custom", "warranty")).toBe("2 years");
    expect(metafieldValueFromSnapshot([], "custom", "missing")).toBe("");
  });

  it("parses custom metafield FormData for Save write-through", () => {
    const form = new FormData();
    form.set("customMetafieldValue:custom:warranty", "2 years");
    form.set("customMetafieldType:custom:warranty", "single_line_text_field");
    form.set("customMetafieldValue:synarava:material", "ignored");
    form.set("customMetafieldType:synarava:material", "single_line_text_field");
    expect(parseCustomMetafieldsForm(form)).toEqual([
      { namespace: "custom", key: "warranty", type: "single_line_text_field", value: "2 years" },
    ]);
  });

  it("merges custom values without touching managed namespaces", () => {
    const merged = mergeCustomMetafieldsIntoList(
      [
        { namespace: "synarava", key: "material", type: "single_line_text_field", value: "Gold" },
        { namespace: "custom", key: "warranty", type: "single_line_text_field", value: "1 year" },
      ],
      [{ namespace: "custom", key: "warranty", type: "single_line_text_field", value: "2 years" }],
    );
    expect(merged).toEqual([
      { namespace: "synarava", key: "material", type: "single_line_text_field", value: "Gold" },
      { namespace: "custom", key: "warranty", type: "single_line_text_field", value: "2 years" },
    ]);
  });

  it("extracts custom metafields from workingSnapshot for Push", () => {
    expect(customMetafieldsFromWorkingSnapshot({
      metafields: [
        { namespace: "custom", key: "warranty", type: "single_line_text_field", value: "2 years" },
        { namespace: "synarava", key: "material", type: "single_line_text_field", value: "Gold" },
      ],
    })).toEqual([
      { namespace: "custom", key: "warranty", type: "single_line_text_field", value: "2 years" },
    ]);
  });

  it("reads custom metafields from identity-map workingSnapshot shape", () => {
    expect(customMetafieldsFromWorkingSnapshot({
      metafields: {
        "custom::warranty": {
          namespace: "custom",
          key: "warranty",
          type: "single_line_text_field",
          value: "2 years",
        },
        "synarava::material": {
          namespace: "synarava",
          key: "material",
          type: "single_line_text_field",
          value: "Gold",
        },
      },
    })).toEqual([
      { namespace: "custom", key: "warranty", type: "single_line_text_field", value: "2 years" },
    ]);
  });

  it("locale-prefixes metafield value field names", () => {
    expect(customMetafieldValueFieldName("custom", "care_instructions")).toBe(
      "customMetafieldValue:custom:care_instructions",
    );
    expect(customMetafieldValueFieldName("custom", "care_instructions", "pt")).toBe(
      "ptCustomMetafieldValue:custom:care_instructions",
    );
    expect(isTranslatableMetafieldType("multi_line_text_field")).toBe(true);
    expect(isTranslatableMetafieldType("number_integer")).toBe(false);
  });

  it("parses and reads per-locale metafield text overlays", () => {
    const form = new FormData();
    form.set("ptCustomMetafieldValue:custom:care_instructions", "Manter seco.");
    form.set("ruCustomMetafieldValue:custom:care_instructions", "Хранить в сухом месте.");
    form.set("ptCustomMetafieldValue:custom:finish", "");
    expect(parseCustomMetafieldTranslationsForm(form)).toEqual({
      pt: { "custom::care_instructions": "Manter seco." },
      ru: { "custom::care_instructions": "Хранить в сухом месте." },
    });
    expect(metafieldTranslationsFromSnapshot({
      metafields: [],
      metafieldTranslations: {
        pt: { "custom::care_instructions": "Manter seco." },
      },
    })).toEqual({
      pt: { "custom::care_instructions": "Manter seco." },
    });
  });

  it("does not let a later empty duplicate FormData key wipe a live overlay", () => {
    const form = new FormData();
    // Product-tab specs submit the edit first; Metafields mirrors used to append
    // a stale empty for the same identity and clear it on save.
    form.append("ptCustomMetafieldValue:custom:care_instructions", "Manter seco.");
    form.append("ptCustomMetafieldValue:custom:care_instructions", "");
    form.append("ruCustomMetafieldValue:custom:material", "Жемчуг");
    form.append("ruCustomMetafieldValue:custom:material", "");
    expect(parseCustomMetafieldTranslationsForm(form)).toEqual({
      pt: { "custom::care_instructions": "Manter seco." },
      ru: { "custom::material": "Жемчуг" },
    });
  });

  it("still clears an overlay when every duplicate FormData value is empty", () => {
    const form = new FormData();
    form.append("ptCustomMetafieldValue:custom:care_instructions", "");
    form.append("ptCustomMetafieldValue:custom:care_instructions", "");
    expect(parseCustomMetafieldTranslationsForm(form)).toEqual({});
  });

  it("maps custom metafield translations onto passport characteristic keys", () => {
    expect(characteristicOverlayFromMetafieldTranslations({
      "custom::material": "Культивированный жемчуг",
      "custom::wrist_fit": "18–21 см",
      "custom::care": "Хранить сухим.",
      "shopify::ignored": "no",
    })).toEqual({
      material: "Культивированный жемчуг",
      fit_notes: "18–21 см",
      care_instructions: "Хранить сухим.",
    });
  });

  it("prefers Shopify metafield translations over Passport overlays for display", () => {
    expect(mergeCharacteristicDisplayOverlay(
      { material: "Из Shopify" },
      { material: "Из Passport", finish: "Только Passport" },
    )).toEqual({
      material: "Из Shopify",
      finish: "Только Passport",
    });
  });

  it("merges Product-tab spec overlays without wiping untouched Metafields keys", () => {
    expect(mergeMetafieldTranslations(
      {
        ru: {
          "custom::material": "Жемчуг",
          "custom::warranty": "1 год",
        },
      },
      { ru: { "custom::material": "Культивированный жемчуг" } },
      { ru: { "custom::material": "" } },
    )).toEqual({
      ru: {
        "custom::material": "Культивированный жемчуг",
        "custom::warranty": "1 год",
      },
    });
    expect(mergeMetafieldTranslations(
      { ru: { "custom::material": "Жемчуг", "custom::warranty": "1 год" } },
      { ru: {} },
      { ru: { "custom::material": "" } },
    )).toEqual({
      ru: { "custom::warranty": "1 год" },
    });
  });
});
