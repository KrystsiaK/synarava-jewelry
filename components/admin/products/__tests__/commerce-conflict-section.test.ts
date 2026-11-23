import {
  conflictLocalesFromCommerce,
  conflictSectionsFromDifferences,
  contentLocalesFromTranslationMap,
  localeDraftHasContent,
  PRESENCE_LOCALE_CONFLICT_HINT,
  productEditorSectionForCommerceDiff,
  productEditorSectionForConflictField,
} from "@/components/admin/products/commerce-conflict-section";
import { sectionForWindowPath } from "@/lib/sync/field-registry";

describe("commerce conflict → editor section (contract metadata)", () => {
  it("maps price facts to the Price tab only", () => {
    expect(productEditorSectionForCommerceDiff({
      path: "variants[0].price",
      field: "Price",
      section: sectionForWindowPath("variants[0].price"),
    })).toBe("price");
    expect(productEditorSectionForCommerceDiff({
      path: "variants[0].taxable",
      field: "Charge tax",
    })).toBe("price");
    expect(productEditorSectionForCommerceDiff({
      path: "variants[0].compareAtPrice",
      field: "Compare-at price",
    })).toBe("price");
  });

  it("maps identity/tags to Product tab and SKU to Inventory", () => {
    expect(productEditorSectionForCommerceDiff({ path: "title", field: "Name" })).toBe("essentials");
    expect(productEditorSectionForCommerceDiff({ path: "vendor", field: "Vendor" })).toBe("essentials");
    expect(productEditorSectionForCommerceDiff({ path: "tags", field: "Tags" })).toBe("essentials");
    expect(productEditorSectionForCommerceDiff({ path: "variants[0].sku", field: "Variant SKU" })).toBe("inventory");
  });

  it("maps inventory and shipping facts to the Inventory tab", () => {
    expect(productEditorSectionForCommerceDiff({ path: "variants[0].barcode", field: "Barcode" })).toBe("inventory");
    expect(productEditorSectionForCommerceDiff({ path: "variants[0].inventoryPolicy", field: "Inventory policy" })).toBe("inventory");
    expect(productEditorSectionForCommerceDiff({
      path: "variants[0].inventoryItem.requiresShipping",
      field: "Requires shipping",
    })).toBe("inventory");
  });

  it("maps metafield diffs to the Metafields tab", () => {
    expect(productEditorSectionForCommerceDiff({ path: "metafields[0].value", field: "Metafields" })).toBe("metafields");
  });

  it("maps presence to Sync, not every tab", () => {
    expect(productEditorSectionForCommerceDiff({ path: "_presence", field: "Presence" })).toBe("shopify");
  });

  it("maps Adopt Shopify to Sync", () => {
    expect(productEditorSectionForCommerceDiff({ path: "_adopt", field: "Adopt Shopify" })).toBe("shopify");
  });

  it("maps media diffs to the Media tab via contract path lookup", () => {
    expect(productEditorSectionForCommerceDiff({ path: "media[0].id", field: "Media gallery (image 1)" })).toBe("media");
    expect(productEditorSectionForConflictField({
      origin: "COMMERCE",
      label: "Media gallery (image 1)",
      fieldKey: "commerce:media-0-id",
      path: "media[0].id",
      section: "media",
    })).toBe("media");
    // Without path/section metadata, unknown labels land on Sync (no regex fallback).
    expect(productEditorSectionForConflictField({
      origin: "COMMERCE",
      label: "media[0].preview.image.url",
      fieldKey: "commerce:media-0-preview-image-url",
    })).toBe("shopify");
  });

  it("maps conflict-modal field rows to the owning section", () => {
    expect(productEditorSectionForConflictField({
      origin: "COMMERCE",
      label: "Price",
      fieldKey: "commerce:price",
      section: "price",
    })).toBe("price");
    expect(productEditorSectionForConflictField({
      origin: "COMMERCE",
      label: "Vendor",
      fieldKey: "commerce:vendor",
      section: "essentials",
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
    expect([...sections].toSorted()).toEqual(["essentials", "price"]);
    expect(sections.has("shopify")).toBe(false);
    expect(sections.has("essentials")).toBe(true);
  });

  it("marks only the base (EN) shell for a shared price conflict", () => {
    const sections = conflictSectionsFromDifferences([
      { path: "variants[0].price", field: "Price" },
    ]);
    const locales = conflictLocalesFromCommerce({
      localeCodes: ["en", "pt", "ru"],
      conflictSections: sections,
    });
    expect([...locales]).toEqual(["en"]);
  });

  it("marks only PT for a PT-only locale signal without shared sections", () => {
    const locales = conflictLocalesFromCommerce({
      localeCodes: ["en", "pt", "ru"],
      conflictSections: new Set(),
      localeSignals: [{ code: "pt", count: 2 }],
    });
    expect([...locales]).toEqual(["pt"]);
  });

  describe("presenceSignal locale tab dots", () => {
    it("marks EN + PT + RU when absent from Shopify and PT/RU have content", () => {
      const locales = conflictLocalesFromCommerce({
        localeCodes: ["en", "pt", "ru"],
        conflictSections: new Set(),
        presenceSignal: true,
        contentLocales: ["pt", "ru"],
      });
      expect([...locales].toSorted()).toEqual(["en", "pt", "ru"]);
    });

    it("marks EN only when absent from Shopify and no translations have content", () => {
      const locales = conflictLocalesFromCommerce({
        localeCodes: ["en", "pt", "ru"],
        conflictSections: new Set(),
        presenceSignal: true,
        contentLocales: [],
      });
      expect([...locales]).toEqual(["en"]);
    });

    it("keeps RU from localeSignals when in Shopify (no presence)", () => {
      const locales = conflictLocalesFromCommerce({
        localeCodes: ["en", "pt", "ru"],
        conflictSections: new Set(),
        presenceSignal: false,
        localeSignals: [{ code: "ru", count: 1 }],
      });
      expect([...locales]).toEqual(["ru"]);
    });

    it("exports presence pip hint for tab tooltip", () => {
      expect(PRESENCE_LOCALE_CONFLICT_HINT).toBe("Not in Shopify yet");
    });

    it("detects contentful translation drafts for presence contentLocales", () => {
      expect(localeDraftHasContent({ title: "", description: "" })).toBe(false);
      expect(localeDraftHasContent({ title: "Anel", description: "" })).toBe(true);
      expect(localeDraftHasContent({ title: "", syncStatus: "PENDING", reviewed: true })).toBe(false);
      expect(contentLocalesFromTranslationMap({
        pt: { title: "Anel" },
        ru: { title: "" },
      }).toSorted()).toEqual(["pt"]);
    });
  });
});
