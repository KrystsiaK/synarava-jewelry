import { describe, expect, it } from "vitest";

import {
  conflictLocalesFromCommerce,
  conflictSectionsFromDifferences,
  productEditorSectionForCommerceDiff,
} from "@/components/admin/products/commerce-conflict-section";

describe("commerce conflict → editor section", () => {
  it("maps price facts to the Price tab only", () => {
    expect(productEditorSectionForCommerceDiff({ path: "variants[0].price", field: "Price" })).toBe("price");
    expect(productEditorSectionForCommerceDiff({ path: "variants[0].taxable", field: "Charge tax" })).toBe("price");
    expect(productEditorSectionForCommerceDiff({ field: "Compare-at price" })).toBe("price");
  });

  it("maps identity/SKU to Essentials", () => {
    expect(productEditorSectionForCommerceDiff({ path: "title", field: "Name" })).toBe("essentials");
    expect(productEditorSectionForCommerceDiff({ path: "vendor", field: "Vendor" })).toBe("essentials");
    expect(productEditorSectionForCommerceDiff({ path: "variants[0].sku", field: "Variant SKU" })).toBe("essentials");
  });

  it("maps presence to Sync, not every tab", () => {
    expect(productEditorSectionForCommerceDiff({ path: "_presence", field: "Presence" })).toBe("shopify");
  });

  it("collects only owning sections from a mixed diff list", () => {
    const sections = conflictSectionsFromDifferences([
      { path: "variants[0].price", field: "Price" },
      { path: "vendor", field: "Vendor" },
      { path: "tags", field: "Tags" },
    ]);
    expect([...sections].toSorted()).toEqual(["catalog", "essentials", "price"]);
    expect(sections.has("shopify")).toBe(false);
    expect(sections.has("content")).toBe(false);
  });

  it("marks every language shell for a shared price conflict", () => {
    const sections = conflictSectionsFromDifferences([
      { path: "variants[0].price", field: "Price" },
    ]);
    const locales = conflictLocalesFromCommerce({
      localeCodes: ["en", "pt", "ru"],
      conflictSections: sections,
    });
    expect([...locales].toSorted()).toEqual(["en", "pt", "ru"]);
  });

  it("marks only PT for a PT-only locale signal without shared sections", () => {
    const locales = conflictLocalesFromCommerce({
      localeCodes: ["en", "pt", "ru"],
      conflictSections: new Set(),
      localeSignals: [{ code: "pt", count: 2 }],
    });
    expect([...locales]).toEqual(["pt"]);
  });
});
