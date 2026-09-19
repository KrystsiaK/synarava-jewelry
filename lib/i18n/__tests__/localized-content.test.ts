import {
  contentCompleteness,
  resolveLocalizedContent,
  storefrontLocaleToContentLocale,
} from "@/lib/i18n/localized-content";

describe("localized content", () => {
  const english = {
    title: "Lava Ring",
    description: "Handwoven in Lisbon.",
    optionalNote: "Limited edition",
  };

  it("maps storefront locales to persisted locale values", () => {
    expect(storefrontLocaleToContentLocale("en")).toBe("EN");
    expect(storefrontLocaleToContentLocale("pt")).toBe("PT");
  });

  it("uses the requested translation while falling back only for optional fields", () => {
    expect(resolveLocalizedContent({
      source: english,
      translation: {
        title: "Anel de Lava",
        description: "Entrelaçado à mão em Lisboa.",
        optionalNote: "",
      },
      optionalFields: ["optionalNote"],
    })).toEqual({
      title: "Anel de Lava",
      description: "Entrelaçado à mão em Lisboa.",
      optionalNote: "Limited edition",
    });
  });

  it("does not silently mix required fields when a translation exists", () => {
    expect(resolveLocalizedContent({
      source: english,
      translation: { title: "Anel de Lava", description: "", optionalNote: "" },
      optionalFields: ["optionalNote"],
    })).toEqual({
      title: "Anel de Lava",
      description: "",
      optionalNote: "Limited edition",
    });
  });

  it("keeps legacy records readable when no translation row exists", () => {
    expect(resolveLocalizedContent({
      source: english,
      translation: null,
      optionalFields: ["optionalNote"],
    })).toEqual(english);
  });

  it("calculates required-field completion without counting whitespace", () => {
    expect(contentCompleteness(
      { title: "Anel", description: "   ", optionalNote: "" },
      ["title", "description"],
    )).toEqual({ complete: false, completed: 1, total: 2, percent: 50, missing: ["description"] });
  });

  it("resolves an optional JSON field to its translation instead of always falling back (regression: object values are never strings, so a naive text check always saw them as blank)", () => {
    const withDetails = { title: "Lava Ring", details: { materialsTitle: "Materials" } };
    expect(resolveLocalizedContent({
      source: withDetails,
      translation: { title: "Anel de Lava", details: { materialsTitle: "Materiais" } },
      optionalFields: ["details"],
    })).toEqual({ title: "Anel de Lava", details: { materialsTitle: "Materiais" } });
  });

  it("still falls back to source for a null/undefined optional JSON field", () => {
    const withDetails = { title: "Lava Ring", details: { materialsTitle: "Materials" } };
    expect(resolveLocalizedContent({
      source: withDetails,
      translation: { title: "Anel de Lava", details: null },
      optionalFields: ["details"],
    })).toEqual({ title: "Anel de Lava", details: { materialsTitle: "Materials" } });
  });

  it("counts a populated JSON field as complete and an empty array/object as missing", () => {
    expect(contentCompleteness({ materials: [{ title: "Lava" }] }, ["materials"]))
      .toMatchObject({ complete: true, missing: [] });
    expect(contentCompleteness({ materials: [] }, ["materials"]))
      .toMatchObject({ complete: false, missing: ["materials"] });
  });
});
