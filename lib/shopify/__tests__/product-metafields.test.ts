import { describe, expect, it } from "vitest";

import {
  customMetafieldsFromWorkingSnapshot,
  isManagedProductMetafieldNamespace,
  listCustomProductMetafieldDefinitions,
  mergeCustomMetafieldsIntoList,
  metafieldValueFromSnapshot,
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
});
