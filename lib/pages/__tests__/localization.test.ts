import { describe, expect, it } from "vitest";

import {
  mergeLocalizedSectionRecord,
  mergeMaterialLexicon,
  normalizePageTranslationContent,
  resolvePageLocalizedCopy,
} from "@/lib/pages/localization";
import { resolveLexiconMaterials } from "@/lib/content/home-lexicon-section";

describe("page localization", () => {
  it("overlays locale-specific Collections callout fields", () => {
    expect(resolvePageLocalizedCopy({
      locale: "pt",
      source: {
        title: "Collections",
        excerpt: "",
        content: {
          eyebrow: "Synarava collections",
          secondaryTitle: "Browse by collection",
          body: "Explore.",
          calloutEyebrow: "Not sure where to start?",
          calloutHeading: "Browse everything in the shop",
          calloutCtaHref: "/shop",
          ctaLabel: "Shop all products",
        },
      },
      translation: {
        title: "Coleções",
        content: {
          eyebrow: "Coleções Synarava",
          secondaryTitle: "Navegar por coleção",
          body: "Explorar.",
          calloutEyebrow: "Não sabe por onde começar?",
          calloutHeading: "Ver tudo na loja",
          calloutCtaHref: "/shop",
          ctaLabel: "Ver todos os produtos",
        },
      },
    }).content).toMatchObject({
      eyebrow: "Coleções Synarava",
      secondaryTitle: "Navegar por coleção",
      body: "Explorar.",
      calloutEyebrow: "Não sabe por onde começar?",
      calloutHeading: "Ver tudo na loja",
      calloutCtaHref: "/shop",
      ctaLabel: "Ver todos os produtos",
    });
  });

  it("validates and removes shared fields from normalized translation content", () => {
    expect(normalizePageTranslationContent({
      eyebrow: "Arquivo",
      body: "Corpo",
      heroImage: "/shared.webp",
      ctaHref: "/shop",
      finalSecondaryCtaLabel: "Sobre nós",
      finalSecondaryCtaHref: "/about",
      materialLexicon: [{ name: "Pérolas", image: "/shared-pearl.webp" }],
    })).toEqual({
      eyebrow: "Arquivo",
      body: "Corpo",
      finalSecondaryCtaLabel: "Sobre nós",
      finalSecondaryCtaHref: "/about",
      materialLexicon: [{ name: "Pérolas" }],
    });
  });

  it("overlays locale-specific Final secondary CTA fields", () => {
    expect(resolvePageLocalizedCopy({
      locale: "pt",
      source: {
        title: "Home",
        excerpt: "",
        content: {
          finalSecondaryCtaLabel: "About us",
          finalSecondaryCtaHref: "/about",
        },
      },
      translation: {
        title: "Início",
        content: {
          finalSecondaryCtaLabel: "Sobre nós",
          finalSecondaryCtaHref: "/collections",
        },
      },
    }).content).toMatchObject({
      finalSecondaryCtaLabel: "Sobre nós",
      finalSecondaryCtaHref: "/collections",
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

  it("keeps material lexicon structure and images from EN while overlaying localized text", () => {
    const resolved = resolvePageLocalizedCopy({
      locale: "pt",
      source: {
        title: "Home",
        excerpt: "",
        content: {
          materialLexicon: [
            {
              name: "Freshwater pearl",
              category: "Organic",
              description: "Natural, irregular.",
              image: "/pearl.webp",
              properties: "Natural, Soft",
            },
            {
              name: "Sterling silver",
              category: "Metal",
              description: "Bright alloy.",
              image: "/silver.webp",
              properties: "Bright",
            },
            {
              name: "Silk thread",
              category: "Fiber",
              description: "Hand-knotted.",
              image: "/silk.webp",
              properties: "Soft",
            },
          ],
        },
      },
      translation: {
        title: "Início",
        excerpt: "",
        content: {
          // Translation rows intentionally omit images (shared). A naive
          // whole-array replace would drop images and collapse the lexicon.
          materialLexicon: [
            { name: "Pérola de água doce", description: "Natural e irregular." },
            { name: "Prata de lei", category: "Metal", description: "" },
          ],
        },
      },
    });

    expect(resolved.content.materialLexicon).toEqual([
      {
        name: "Pérola de água doce",
        category: "Organic",
        description: "Natural e irregular.",
        image: "/pearl.webp",
        properties: "Natural, Soft",
      },
      {
        name: "Prata de lei",
        category: "Metal",
        description: "Bright alloy.",
        image: "/silver.webp",
        properties: "Bright",
      },
      {
        name: "Silk thread",
        category: "Fiber",
        description: "Hand-knotted.",
        image: "/silk.webp",
        properties: "Soft",
      },
    ]);

    // Storefront gate must still see three specimens after locale resolve.
    expect(resolveLexiconMaterials({
      materialLexicon: resolved.content.materialLexicon as Array<{
        name?: string;
        category?: string;
        description?: string;
        image?: string;
        properties?: string;
      }>,
    })).toHaveLength(3);
  });

  it("does not let a partial PT legalSections map delete EN section keys", () => {
    const resolved = resolvePageLocalizedCopy({
      locale: "pt",
      source: {
        title: "Privacy",
        excerpt: "",
        content: {
          legalSections: {
            intro: { title: "Intro", body: "English intro" },
            cookies: { title: "Cookies", body: "English cookies" },
          },
        },
      },
      translation: {
        title: "Privacidade",
        excerpt: "",
        content: {
          legalSections: {
            intro: { title: "Introdução", body: "Introdução PT" },
          },
        },
      },
    });

    expect(resolved.content.legalSections).toEqual({
      intro: { title: "Introdução", body: "Introdução PT" },
      cookies: { title: "Cookies", body: "English cookies" },
    });
  });

  it("keeps EN section order when legalSections are stored as arrays", () => {
    const resolved = resolvePageLocalizedCopy({
      locale: "pt",
      source: {
        title: "Privacy",
        excerpt: "",
        content: {
          legalSections: [
            { id: "intro", label: "1. Intro", title: "Intro", body: "English intro" },
            { id: "cookies", label: "2. Cookies", title: "Cookies", body: "English cookies" },
          ],
        },
      },
      translation: {
        title: "Privacidade",
        excerpt: "",
        content: {
          legalSections: [
            { id: "intro", label: "1. Introdução", title: "Introdução", body: "Introdução PT" },
          ],
        },
      },
    });

    expect(resolved.content.legalSections).toEqual([
      { id: "intro", label: "1. Introdução", title: "Introdução", body: "Introdução PT" },
      { id: "cookies", label: "2. Cookies", title: "Cookies", body: "English cookies" },
    ]);
  });
});

describe("mergeMaterialLexicon", () => {
  it("ignores translation-only extra rows (structure is source-owned)", () => {
    expect(mergeMaterialLexicon(
      [{ name: "One", image: "/1.webp", description: "A" }],
      [
        { name: "Uma", description: "A PT" },
        { name: "Extra should not appear", description: "X" },
      ],
    )).toEqual([{ name: "Uma", image: "/1.webp", description: "A PT", category: undefined, properties: undefined }]);
  });
});

describe("mergeLocalizedSectionRecord", () => {
  it("returns undefined when source is missing, and keeps empty arrays", () => {
    expect(mergeLocalizedSectionRecord(undefined, { a: { title: "X" } })).toBeUndefined();
    expect(mergeLocalizedSectionRecord([], { a: { title: "X" } })).toEqual([]);
  });
});
