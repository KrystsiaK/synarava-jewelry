import { describe, expect, it } from "vitest";

import { ownedLocalizedPageFields } from "@/lib/pages/localization";
import {
  resolveTermsHeaderCopy,
  TERMS_INTRO_DEFAULT,
  TERMS_RU_EXCERPT_DEFAULT,
} from "@/lib/content/terms-defaults";

const ENGLISH_INTRO = "These Terms & Conditions apply to purchases made through Synarava Shop. Please read them before placing an order.";

describe("terms header defaults", () => {
  it("uses the Russian eyebrow and excerpt when those fields are empty", () => {
    expect(resolveTermsHeaderCopy({
      locale: "ru",
      eyebrow: "  ",
      excerpt: "",
      intro: ENGLISH_INTRO,
    })).toEqual({
      eyebrow: "ЮРИДИЧЕСКАЯ ИНФОРМАЦИЯ",
      excerpt: TERMS_RU_EXCERPT_DEFAULT,
    });
  });

  it("uses the Portuguese eyebrow and keeps the existing excerpt", () => {
    expect(resolveTermsHeaderCopy({
      locale: "pt",
      eyebrow: "",
      excerpt: "",
      intro: "Estes termos aplicam-se às compras na Synarava.",
    })).toEqual({
      eyebrow: "INFORMAÇÃO LEGAL",
      excerpt: "Estes termos aplicam-se às compras na Synarava.",
    });
  });

  it("lets an admin value replace the locale default", () => {
    expect(resolveTermsHeaderCopy({
      locale: "ru",
      eyebrow: "СВОЙ ЗАГОЛОВОК",
      excerpt: "Свой абзац из админки.",
      intro: ENGLISH_INTRO,
    })).toEqual({
      eyebrow: "СВОЙ ЗАГОЛОВОК",
      excerpt: "Свой абзац из админки.",
    });
    expect(resolveTermsHeaderCopy({
      locale: "pt",
      eyebrow: "AVISO",
      excerpt: "Texto guardado.",
      intro: "Intro antigo",
    })).toEqual({
      eyebrow: "AVISO",
      excerpt: "Texto guardado.",
    });
  });

  it("keeps the English eyebrow and intro when the saved fields are empty", () => {
    expect(resolveTermsHeaderCopy({
      locale: "en",
      eyebrow: "",
      excerpt: "",
      intro: "",
    })).toEqual({
      eyebrow: "Legal",
      excerpt: TERMS_INTRO_DEFAULT,
    });
  });
});

describe("owned terms header fields", () => {
  it("does not inherit the English eyebrow or excerpt into an empty locale", () => {
    expect(ownedLocalizedPageFields({
      locale: "ru",
      source: {
        title: "Terms & Conditions",
        excerpt: "English excerpt",
        content: { eyebrow: "Legal" },
      },
      translation: { title: "Условия и положения", excerpt: "  ", content: { eyebrow: "" } },
    })).toEqual({ eyebrow: "", excerpt: "" });
  });

  it("returns the locale’s saved eyebrow and excerpt", () => {
    expect(ownedLocalizedPageFields({
      locale: "pt",
      source: {
        title: "Terms & Conditions",
        excerpt: "English excerpt",
        content: { eyebrow: "Legal" },
      },
      translation: {
        title: "Termos e Condições",
        excerpt: "Resumo guardado",
        content: { eyebrow: "AVISO" },
      },
    })).toEqual({ eyebrow: "AVISO", excerpt: "Resumo guardado" });
  });
});
