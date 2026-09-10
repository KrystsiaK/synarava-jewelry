import {
  postLocaleReadiness,
  resolvePostTranslation,
  validatePostPublication,
} from "@/lib/posts/localization";

const translations = [
  {
    locale: "EN" as const,
    title: "Inside the Lisbon studio",
    excerpt: "A short visit.",
    body: "The morning begins with stone.",
    reviewStatus: "REVIEWED" as const,
  },
  {
    locale: "PT" as const,
    title: "Dentro do atelier de Lisboa",
    excerpt: "Uma breve visita.",
    body: "A manhã começa com pedra.",
    reviewStatus: "DRAFT" as const,
  },
];

describe("post localization", () => {
  it("resolves the requested locale without cross-language fallback", () => {
    expect(resolvePostTranslation(translations, "pt")?.title).toBe("Dentro do atelier de Lisboa");
    expect(resolvePostTranslation(translations, "en")?.title).toBe("Inside the Lisbon studio");
    expect(resolvePostTranslation(translations.filter((item) => item.locale === "EN"), "pt")).toBeNull();
  });

  it("reports completion and review independently", () => {
    expect(postLocaleReadiness(translations, "pt")).toEqual({
      complete: true,
      reviewed: false,
      percent: 100,
      missing: [],
    });
  });

  it("requires complete reviewed EN and PT before first publication", () => {
    expect(validatePostPublication({ translations })).toEqual([
      "Portuguese review",
    ]);
  });
});
