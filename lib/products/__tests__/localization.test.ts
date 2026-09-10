import {
  productLocaleReadiness,
  resolveProductCopy,
  validateProductPublication,
  type LocalizableProduct,
} from "@/lib/products/localization";

function product(overrides: Partial<LocalizableProduct> = {}): LocalizableProduct {
  return {
    name: "Lava Ring",
    shortDescription: "A handwoven ring.",
    description: "Made in Lisbon.",
    materialLine: "Lava stone and silver",
    symbolismLabel: "Symbolic language",
    symbolismTitle: "Grounded energy",
    symbolismBody: "A tactile reminder.",
    symbolismBody2: null,
    details: { materialsTitle: "Materials" },
    seoTitle: "Lava Ring",
    seoDescription: "Shop the Lava Ring.",
    translations: [],
    ...overrides,
  };
}

describe("product localization", () => {
  it("uses the Shopify-owned English source when its persisted mirror is stale", () => {
    const resolved = resolveProductCopy(product({
      translations: [{ locale: "EN", title: "Stale English title", description: "Stale description" }],
    }), "en");

    expect(resolved.title).toBe("Lava Ring");
    expect(resolved.description).toBe("Made in Lisbon.");
  });

  it("returns Portuguese copy and only falls back for optional fields", () => {
    const resolved = resolveProductCopy(product({
      translations: [{
        locale: "PT",
        title: "Anel de Lava",
        shortDescription: "Um anel entrelaçado.",
        description: "Feito em Lisboa.",
        materialLine: null,
        symbolismLabel: null,
        symbolismTitle: null,
        symbolismBody: null,
        symbolismBody2: null,
        details: null,
        seoTitle: null,
        seoDescription: null,
        reviewStatus: "REVIEWED",
      }],
    }), "pt");

    expect(resolved.title).toBe("Anel de Lava");
    expect(resolved.description).toBe("Feito em Lisboa.");
    expect(resolved.materialLine).toBe("Lava stone and silver");
  });

  it("reports missing Portuguese publish fields and review state", () => {
    expect(productLocaleReadiness(product({
      translations: [{
        locale: "PT",
        title: "Anel de Lava",
        shortDescription: "",
        description: "",
        reviewStatus: "DRAFT",
      }],
    }), "pt")).toEqual({
      complete: false,
      reviewed: false,
      percent: 33,
      missing: ["shortDescription", "description"],
    });
  });

  it("blocks a new publication until EN and reviewed PT are complete", () => {
    expect(validateProductPublication({
      isAlreadyPublic: false,
      english: { title: "Lava Ring", shortDescription: "", description: "Made in Lisbon." },
      portuguese: { title: "Anel de Lava", shortDescription: "Um anel.", description: "Feito em Lisboa." },
      portugueseReviewed: false,
    })).toEqual([
      "English short description",
      "Portuguese review",
    ]);
  });

  it("lets an already-public legacy product save while translations are completed", () => {
    expect(validateProductPublication({
      isAlreadyPublic: true,
      english: { title: "Legacy", shortDescription: "", description: "" },
      portuguese: { title: "", shortDescription: "", description: "" },
      portugueseReviewed: false,
    })).toEqual([]);
  });
});
