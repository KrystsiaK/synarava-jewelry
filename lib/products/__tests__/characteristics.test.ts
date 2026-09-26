import { describe, expect, it } from "vitest";

import {
  buildProductSearchDocument,
  characteristicDisplayValue,
  characteristicGroupLabel,
  characteristicLabel,
  characteristicUnit,
  parseCharacteristicsForm,
  parseCharacteristicTextOverlay,
  PRODUCT_CHARACTERISTIC_GROUPS,
  PRODUCT_CHARACTERISTICS,
  readCharacteristicTextOverlayFromForm,
  resolveCharacteristicDisplayValue,
} from "@/lib/products/characteristics";

describe("product characteristics", () => {
  it("keeps a jewelry-core passport only", () => {
    expect(PRODUCT_CHARACTERISTIC_GROUPS).toEqual([
      "Dimensions & fit",
      "Materials & construction",
      "Care",
      "Compliance",
    ]);
    expect(PRODUCT_CHARACTERISTICS.some((item) => item.key === "material")).toBe(true);
    expect(PRODUCT_CHARACTERISTICS.some((item) => item.key === "intended_pet")).toBe(false);
    expect(PRODUCT_CHARACTERISTICS.some((item) => item.key === "tool_compatibility")).toBe(false);
    expect(PRODUCT_CHARACTERISTICS.length).toBeLessThanOrEqual(16);
  });

  it("parses typed values and certificate metadata", () => {
    const form = new FormData();
    form.set("characteristic_chain_length", "42");
    form.set("characteristic_material", "316L stainless steel");
    form.set("characteristic_reach_certified", "on");
    form.set("characteristic_reach_certified_certificate", "https://example.com/reach.pdf");

    const values = parseCharacteristicsForm(form);
    expect(values.find((item) => item.key === "chain_length")?.numberValue).toBe(42);
    expect(values.find((item) => item.key === "material")?.textValue).toBe("316L stainless steel");
    expect(values.find((item) => item.key === "reach_certified")).toMatchObject({
      booleanValue: true,
      certificateUrl: "https://example.com/reach.pdf",
    });
  });

  it("includes typed characteristics in the search document", () => {
    const form = new FormData();
    form.set("characteristic_metal", "Gold");
    form.set("characteristic_lead_free", "on");
    const characteristics = parseCharacteristicsForm(form);

    expect(buildProductSearchDocument({ name: "Link", sku: "L-12", slug: "link", characteristics }))
      .toContain("Gold");
  });

  it("parses care and finish fields used by filters and PDP", () => {
    const form = new FormData();
    form.set("characteristic_finish", "Rhodium");
    form.set("characteristic_care_instructions", "Keep dry and store separately.");
    form.set("characteristic_origin", "Portugal");

    const values = parseCharacteristicsForm(form);
    expect(values.find((item) => item.key === "finish")).toMatchObject({
      textValue: "Rhodium",
      filterable: true,
    });
    expect(values.find((item) => item.key === "care_instructions")).toMatchObject({
      textValue: "Keep dry and store separately.",
      filterable: false,
    });
    expect(values.find((item) => item.key === "origin")?.textValue).toBe("Portugal");
  });

  it("reads locale TEXT overlays from FormData and details JSON", () => {
    const form = new FormData();
    form.set("ptCharacteristic_material", "Aço inoxidável");
    form.set("ptCharacteristic_color", "Âmbar");
    expect(readCharacteristicTextOverlayFromForm(form, "pt")).toEqual({
      material: "Aço inoxidável",
      color: "Âmbar",
    });
    expect(readCharacteristicTextOverlayFromForm(form, "en")).toEqual({});
    expect(parseCharacteristicTextOverlay({
      characteristics: { material: "Жемчуг", unknown: "ignore" },
    })).toEqual({ material: "Жемчуг" });
  });
});

describe("characteristicLabel / characteristicGroupLabel / characteristicUnit", () => {
  it("returns the English label unchanged for the en locale", () => {
    expect(characteristicLabel("material", "Primary material", "en")).toBe("Primary material");
    expect(characteristicGroupLabel("Materials & construction", "en")).toBe("Materials & construction");
    expect(characteristicUnit("cm", "en")).toBe("cm");
  });

  it("has Portuguese and Russian translations for every defined characteristic and group", () => {
    const NO_TRANSLATION = "\0NO_TRANSLATION\0";
    for (const locale of ["pt", "ru"] as const) {
      for (const definition of PRODUCT_CHARACTERISTICS) {
        const label = characteristicLabel(definition.key, NO_TRANSLATION, locale);
        expect(label, `missing ${locale} label for "${definition.key}"`).not.toBe(NO_TRANSLATION);
      }
      for (const group of PRODUCT_CHARACTERISTIC_GROUPS) {
        const label = characteristicGroupLabel(group, locale);
        expect(label, `missing ${locale} label for group "${group}"`).not.toBe(group);
      }
    }
  });

  it("localizes units for display", () => {
    expect(characteristicUnit("cm", "ru")).toBe("см");
    expect(characteristicUnit("g", "ru")).toBe("г");
    expect(characteristicUnit("cm", "pt")).toBe("cm");
  });

  it("falls back to the persisted English label for an unrecognized/legacy key", () => {
    expect(characteristicLabel("legacy_unknown_key", "Legacy Label", "pt")).toBe("Legacy Label");
    expect(characteristicGroupLabel("Legacy Group", "pt")).toBe("Legacy Group");
  });

  it("localizes boolean display values without changing stored data", () => {
    const value = {
      key: "lead_free", label: "Lead free", group: "Compliance", valueType: "BOOLEAN" as const,
      textValue: null, numberValue: null, booleanValue: true, unit: null, certificateUrl: null, sortOrder: 0,
    };
    expect(characteristicDisplayValue(value, "en")).toBe("Yes");
    expect(characteristicDisplayValue(value, "pt")).toBe("Sim");
    expect(characteristicDisplayValue(value, "ru")).toBe("Да");
  });

  it("resolves TEXT overlay over EN source value", () => {
    const value = {
      key: "material", label: "Primary material", group: "Materials & construction", valueType: "TEXT" as const,
      textValue: "Freshwater pearl", numberValue: null, booleanValue: null, unit: null, certificateUrl: null, sortOrder: 0,
    };
    expect(resolveCharacteristicDisplayValue(value, "pt", { material: "Pérola de água doce" }))
      .toBe("Pérola de água doce");
    expect(resolveCharacteristicDisplayValue(value, "pt", {})).toBe("Freshwater pearl");
  });

  it("formats NUMBER with localized unit", () => {
    const value = {
      key: "chain_length", label: "Chain length", group: "Dimensions & fit", valueType: "NUMBER" as const,
      textValue: null, numberValue: 42, booleanValue: null, unit: "cm", certificateUrl: null, sortOrder: 0,
    };
    expect(characteristicDisplayValue(value, "ru")).toBe("42 см");
  });
});
