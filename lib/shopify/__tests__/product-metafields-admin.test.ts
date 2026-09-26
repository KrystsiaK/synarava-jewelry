import { describe, expect, it } from "vitest";

import {
  isManagedProductMetafieldNamespace,
  listCustomProductMetafieldDefinitions,
  type ProductMetafieldDefinition,
} from "@/lib/shopify/product-metafields-shared";

describe("product metafields admin helpers", () => {
  it("hides passport and taxonomy namespaces from the custom editor", () => {
    expect(isManagedProductMetafieldNamespace("synarava")).toBe(true);
    expect(isManagedProductMetafieldNamespace("shopify")).toBe(true);
    expect(isManagedProductMetafieldNamespace("custom")).toBe(false);
  });

  it("lists only merchant custom definitions sorted by name", () => {
    const definitions: ProductMetafieldDefinition[] = [
      { id: "1", namespace: "synarava", key: "material", name: "Primary material", type: "single_line_text_field", description: null },
      { id: "2", namespace: "custom", key: "warranty", name: "Warranty", type: "multi_line_text_field", description: null },
      { id: "3", namespace: "custom", key: "fit", name: "Fit note", type: "single_line_text_field", description: null },
      { id: "4", namespace: "shopify", key: "color-pattern", name: "Color", type: "list.metaobject_reference", description: null },
    ];
    expect(listCustomProductMetafieldDefinitions(definitions).map((item) => item.key)).toEqual(["fit", "warranty"]);
  });
});
