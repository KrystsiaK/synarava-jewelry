import { describe, expect, it } from "vitest";

import {
  buildProductSearchDocument,
  parseCharacteristicsForm,
  PRODUCT_CHARACTERISTIC_GROUPS,
} from "@/lib/products/characteristics";

describe("product characteristics", () => {
  it("parses typed values and certificate metadata", () => {
    const form = new FormData();
    form.set("characteristic_length", "12.5");
    form.set("characteristic_material", "316L stainless steel");
    form.set("characteristic_reach_certified", "on");
    form.set("characteristic_reach_certified_certificate", "https://example.com/reach.pdf");

    const values = parseCharacteristicsForm(form);
    expect(values.find((item) => item.key === "length")?.numberValue).toBe(12.5);
    expect(values.find((item) => item.key === "material")?.textValue).toBe("316L stainless steel");
    expect(values.find((item) => item.key === "reach_certified")).toMatchObject({
      booleanValue: true,
      certificateUrl: "https://example.com/reach.pdf",
    });
  });

  it("includes typed characteristics in the search document", () => {
    const form = new FormData();
    form.set("characteristic_clasp_type", "Carabiner");
    form.set("characteristic_lead_free", "on");
    const characteristics = parseCharacteristicsForm(form);

    expect(buildProductSearchDocument({ name: "Link", sku: "L-12", slug: "link", characteristics }))
      .toContain("Carabiner");
  });

  it("supports the expanded product passport without making prose a facet", () => {
    const form = new FormData();
    form.set("characteristic_pearl_type", "Freshwater pearl");
    form.set("characteristic_care_instructions", "Keep dry and store separately.");
    form.set("characteristic_made_to_order", "on");

    const values = parseCharacteristicsForm(form);
    expect(PRODUCT_CHARACTERISTIC_GROUPS).toEqual([
      "Dimensions & fit",
      "Materials & construction",
      "Care & fulfilment",
      "Compliance & sales",
    ]);
    expect(values.find((item) => item.key === "pearl_type")).toMatchObject({
      textValue: "Freshwater pearl",
      filterable: true,
    });
    expect(values.find((item) => item.key === "care_instructions")).toMatchObject({
      textValue: "Keep dry and store separately.",
      filterable: false,
    });
    expect(values.find((item) => item.key === "made_to_order")?.booleanValue).toBe(true);
  });
});
