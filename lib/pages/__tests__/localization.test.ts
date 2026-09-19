import { describe, expect, it } from "vitest";

import {
  normalizePageTranslationContent,
  resolvePageLocalizedCopy,
} from "@/lib/pages/localization";

describe("page localization", () => {
  it("validates and removes shared fields from normalized translation content", () => {
    expect(normalizePageTranslationContent({
      eyebrow: "Arquivo",
      body: "Corpo",
      heroImage: "/shared.webp",
      ctaHref: "/shop",
      materialLexicon: [{ name: "Pérolas", image: "/shared-pearl.webp" }],
    })).toEqual({
      eyebrow: "Arquivo",
      body: "Corpo",
      materialLexicon: [{ name: "Pérolas" }],
    });
  });

  it("prefers a normalized PT row and falls back field by field to English", () => {
    expect(resolvePageLocalizedCopy({
      locale: "pt",
      source: { title: "Home", excerpt: "English", content: { body: "English body", quote: "Keep me", heroImage: "/hero.webp" } },
      translation: { title: "Início", excerpt: "", content: { body: "Corpo", quote: "" } },
      legacyTranslation: { title: "Legado", excerpt: "Legado", body: "Legado" },
    })).toEqual({
      title: "Início",
      excerpt: "English",
      content: { body: "Corpo", quote: "Keep me", heroImage: "/hero.webp" },
    });
  });

  it("uses the legacy PT JSON only when no normalized row exists", () => {
    expect(resolvePageLocalizedCopy({
      locale: "pt",
      source: { title: "About", excerpt: "English", content: { body: "English body" } },
      translation: null,
      legacyTranslation: { title: "Sobre", excerpt: "Português", body: "Corpo" },
    })).toMatchObject({ title: "Sobre", excerpt: "Português", content: { body: "Corpo" } });
  });
});
