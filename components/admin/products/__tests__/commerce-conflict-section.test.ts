import {
  conflictLocalesFromCommerce,
  conflictSectionsFromDifferences,
  productEditorSectionForCommerceDiff,
  productEditorSectionForConflictField,
} from "@/components/admin/products/commerce-conflict-section";

describe("commerce conflict → editor section", () => {
  it("maps price facts to the Price tab only", () => {
    expect(productEditorSectionForCommerceDiff({ path: "variants[0].price", field: "Price" })).toBe("price");
    expect(productEditorSectionForCommerceDiff({ path: "variants[0].taxable", field: "Charge tax" })).toBe("price");
    expect(productEditorSectionForCommerceDiff({ field: "Compare-at price" })).toBe("price");
  });

  it("maps identity/tags to Product tab and SKU to Sync (until Inventory)", () => {
    expect(productEditorSectionForCommerceDiff({ path: "title", field: "Name" })).toBe("essentials");
    expect(productEditorSectionForCommerceDiff({ path: "vendor", field: "Vendor" })).toBe("essentials");
    expect(productEditorSectionForCommerceDiff({ path: "tags", field: "Tags" })).toBe("essentials");
    expect(productEditorSectionForCommerceDiff({ path: "variants[0].sku", field: "Variant SKU" })).toBe("shopify");
  });

  it("maps metafield diffs to the Metafields tab", () => {
    expect(productEditorSectionForCommerceDiff({ path: "metafields[0].value", field: "Metafields" })).toBe("metafields");
  });

  it("maps presence to Sync, not every tab", () => {
    expect(productEditorSectionForCommerceDiff({ path: "_presence", field: "Presence" })).toBe("shopify");
  });

  it("maps conflict-modal field rows to the owning section", () => {
    expect(productEditorSectionForConflictField({
      origin: "COMMERCE",
      label: "Price",
      fieldKey: "commerce:price",
    })).toBe("price");
    expect(productEditorSectionForConflictField({
      origin: "COMMERCE",
      label: "Vendor",
      fieldKey: "commerce:vendor",
    })).toBe("essentials");
    expect(productEditorSectionForConflictField({
      origin: "TRANSLATION",
      label: "Title",
      fieldKey: "translation:pt:title",
    })).toBe("essentials");
    expect(productEditorSectionForConflictField({
      origin: "TRANSLATION",
      label: "Description",
      fieldKey: "translation:ru:description",
    })).toBe("essentials");
    expect(productEditorSectionForConflictField({
      origin: "TRANSLATION",
      label: "Short description",
      fieldKey: "translation:pt:shortDescription",
    })).toBe("details");
  });

  it("collects only owning sections from a mixed diff list", () => {
    const sections = conflictSectionsFromDifferences([
      { path: "variants[0].price", field: "Price" },
      { path: "vendor", field: "Vendor" },
      { path: "tags", field: "Tags" },
      { path: "category", field: "Product category" },
    ]);
    expect([...sections].toSorted()).toEqual(["catalog", "essentials", "price"]);
    expect(sections.has("shopify")).toBe(false);
    expect(sections.has("essentials")).toBe(true);
    expect(sections.has("content" as never)).toBe(false);
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
