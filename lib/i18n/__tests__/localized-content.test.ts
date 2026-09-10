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
});
