import {
  collectionLocaleReadiness,
  resolveCollectionCopy,
  validateCollectionPublication,
  type LocalizableCollection,
} from "@/lib/collections/localization";

function collection(overrides: Partial<LocalizableCollection> = {}): LocalizableCollection {
  return {
    name: "Earth Rituals",
    description: "Grounded, tactile pieces.",
    manifesto: "We work with what the earth gives us.",
    symbolismLabel: "Symbolic language",
    symbolismTitle: "Grounded energy",
    symbolismBody: "A tactile reminder.",
    symbolismBody2: null,
    searchSummary: "Earth-toned jewelry collection",
    seoTitle: "Earth Rituals",
    seoDescription: "Shop the Earth Rituals collection.",
    translations: [],
    ...overrides,
  };
}

describe("collection localization", () => {
  it("returns Portuguese copy and only falls back for optional fields", () => {
    const resolved = resolveCollectionCopy(collection({
      translations: [{
        locale: "pt",
        name: "Rituais da Terra",
        description: "Peças fundamentadas.",
        manifesto: null,
        symbolismLabel: null,
        symbolismTitle: null,
        symbolismBody: null,
        symbolismBody2: null,
        searchSummary: null,
        seoTitle: null,
        seoDescription: null,
        reviewStatus: "REVIEWED",
      }],
    }), "pt");

    expect(resolved.name).toBe("Rituais da Terra");
    expect(resolved.description).toBe("Peças fundamentadas.");
    expect(resolved.manifesto).toBe("We work with what the earth gives us.");
  });

  it("reports missing Portuguese publish fields and review state", () => {
    expect(collectionLocaleReadiness(collection(), "pt", { published: true })).toEqual({
      complete: false,
      reviewed: false,
      percent: 0,
      missing: ["name", "description", "seoTitle", "seoDescription"],
    });
  });

  it("is complete for English by default (all required fields already present)", () => {
    expect(collectionLocaleReadiness(collection(), "en", { published: true })).toMatchObject({ complete: true, reviewed: true });
  });

  it("blocks a new publication until EN and reviewed PT are complete", () => {
    const english = resolveCollectionCopy(collection(), "en");
    expect(validateCollectionPublication({
      isAlreadyPublic: false,
      english,
      portuguese: { ...english, name: "Rituais da Terra", seoTitle: "" },
      portugueseReviewed: false,
    })).toEqual([
      "Portuguese SEO title",
      "Portuguese review",
    ]);
  });

  it("lets an already-public legacy collection save while translations are completed", () => {
    const empty = { name: "", description: "", manifesto: "", symbolismLabel: "", symbolismTitle: "", symbolismBody: "", symbolismBody2: "", searchSummary: "", seoTitle: "", seoDescription: "" };
    expect(validateCollectionPublication({
      isAlreadyPublic: true,
      english: empty,
      portuguese: empty,
      portugueseReviewed: false,
    })).toEqual([]);
  });
});
