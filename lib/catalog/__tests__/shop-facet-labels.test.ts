import { describe, expect, it } from "vitest";

import {
  buildCharacteristicFacetLabelMap,
  buyerFacingTagNames,
  characteristicFacetLabel,
  isBuyerFacingTagName,
  localizeShopFacetValue,
} from "../shop-facet-labels";

describe("localizeShopFacetValue", () => {
  it("passes English through unchanged", () => {
    expect(localizeShopFacetValue("Brooches", "en")).toBe("Brooches");
  });

  it("localizes jewelry category / product-type leaves for RU and PT", () => {
    expect(localizeShopFacetValue("Brooches", "ru")).toBe("Броши");
    expect(localizeShopFacetValue("Necklaces", "ru")).toBe("Колье");
    expect(localizeShopFacetValue("Earrings", "pt")).toBe("Brincos");
    expect(localizeShopFacetValue("18K Gold PVD", "ru")).toBe("PVD золото 18K");
  });

  it("falls back to the English source when no map entry exists", () => {
    expect(localizeShopFacetValue("Custom Alloy X", "ru")).toBe("Custom Alloy X");
  });

  it("prefers DB overlays over the shipped dictionary", () => {
    const overlays = new Map([["Brooches", "Админ-броши"]]);
    expect(localizeShopFacetValue("Brooches", "ru", overlays)).toBe("Админ-броши");
  });
});

describe("characteristicFacetLabel", () => {
  it("prefers passport text overlays over the dictionary", () => {
    const overlays = new Map([["Pearl", "Речной жемчуг"]]);
    expect(characteristicFacetLabel("Pearl", "ru", overlays)).toBe("Речной жемчуг");
  });

  it("uses the jewelry dictionary when no overlay exists", () => {
    expect(characteristicFacetLabel("Pearl", "ru")).toBe("Жемчуг");
  });
});

describe("buildCharacteristicFacetLabelMap", () => {
  it("maps EN textValue to the first locale overlay for that key", () => {
    const map = buildCharacteristicFacetLabelMap([
      { key: "material", textValue: "Pearl", details: { characteristics: { material: "Жемчуг" } } },
      { key: "material", textValue: "Pearl", details: { characteristics: { material: "Ignored second" } } },
      { key: "finish", textValue: "18K Gold PVD", details: { characteristics: { finish: "Золотое покрытие" } } },
    ], "material", "ru");
    expect(map.get("Pearl")).toBe("Жемчуг");
    expect(map.has("18K Gold PVD")).toBe(false);
  });
});

describe("buyerFacingTagNames", () => {
  it("drops SKU-like operational tags", () => {
    expect(isBuyerFacingTagName("JW-BROOCH-STEEL-GOLD-PVD-001")).toBe(false);
    expect(isBuyerFacingTagName("Heritage")).toBe(true);
    expect(buyerFacingTagNames([
      "JW-BROOCH-STEEL-GOLD-PVD-001",
      "Pearl",
      "aa-12-34",
    ])).toEqual(["Pearl"]);
  });
});
