import { describe, expect, it } from "vitest";

import { SITE_SEO_DEFAULTS } from "@/lib/content/site-seo-fields";
import {
  composeDocumentTitle,
  isBrandFirstTitle,
  metadataDocumentTitle,
  resolveHomeDocumentTitle,
  stripTitleTemplateBrand,
  titleTemplateSuffix,
} from "../document-title";

describe("titleTemplateSuffix", () => {
  it("reads the brand segment after %s", () => {
    expect(titleTemplateSuffix("%s | Synarava")).toBe(" | Synarava");
    expect(titleTemplateSuffix("Brand only")).toBe("");
  });
});

describe("stripTitleTemplateBrand", () => {
  it("removes one or more trailing template brand suffixes", () => {
    expect(stripTitleTemplateBrand("Golden Bird Brooch | Synarava")).toBe(
      "Golden Bird Brooch",
    );
    expect(stripTitleTemplateBrand("Golden Bird Brooch | Synarava | Synarava")).toBe(
      "Golden Bird Brooch",
    );
    expect(stripTitleTemplateBrand("Golden Bird Brooch")).toBe("Golden Bird Brooch");
  });
});

describe("composeDocumentTitle", () => {
  it("applies the site template once when the page title has no brand", () => {
    expect(composeDocumentTitle("Golden Bird Brooch")).toBe(
      "Golden Bird Brooch | Synarava",
    );
  });

  it("does not duplicate brand when Shopify SEO title already ends with Synarava", () => {
    expect(composeDocumentTitle("Golden Bird Brooch | Synarava")).toBe(
      "Golden Bird Brooch | Synarava",
    );
    expect(composeDocumentTitle("Golden Bird Brooch | Synarava | Synarava")).toBe(
      "Golden Bird Brooch | Synarava",
    );
  });

  it("honors a custom title template", () => {
    expect(composeDocumentTitle("Rings", "%s — Shop")).toBe("Rings — Shop");
    expect(composeDocumentTitle("Rings — Shop", "%s — Shop")).toBe("Rings — Shop");
  });

  it("falls back when the page title is empty or brand-only", () => {
    expect(composeDocumentTitle("")).toBe("Synarava");
    expect(composeDocumentTitle(" | Synarava")).toBe("Synarava");
  });
});

describe("metadataDocumentTitle", () => {
  it("returns an absolute title so Next does not re-apply the layout template", () => {
    expect(metadataDocumentTitle("Golden Bird Brooch | Synarava")).toEqual({
      absolute: "Golden Bird Brooch | Synarava",
    });
    expect(metadataDocumentTitle("Shop", SITE_SEO_DEFAULTS.titleTemplate)).toEqual({
      absolute: "Shop | Synarava",
    });
  });
});

describe("isBrandFirstTitle", () => {
  it("detects titles that lead with Synarava", () => {
    expect(isBrandFirstTitle("Synarava | Curated Goods")).toBe(true);
    expect(isBrandFirstTitle("synarava — shop")).toBe(true);
    expect(isBrandFirstTitle("TODAY, THIS.")).toBe(false);
    expect(isBrandFirstTitle("Everyday jewellery | Synarava")).toBe(false);
  });
});

describe("resolveHomeDocumentTitle", () => {
  const EN = "Jewellery & Accessories for Everyday Wear | Synarava";
  const PT = "Joalharia e acessórios para todos os dias | Synarava";
  const RU = "Украшения и аксессуары на каждый день | Synarava";

  it("prefers a localized page SEO title for EN/PT/RU (trailing brand)", () => {
    expect(
      resolveHomeDocumentTitle({
        seoTitle: EN,
        siteDefaultTitle: "Synarava | Curated Goods",
        fallbackTitle: "Synarava | Curated Goods",
      }),
    ).toBe(EN);
    expect(
      resolveHomeDocumentTitle({
        seoTitle: PT,
        siteDefaultTitle: null,
        fallbackTitle: "Synarava | Seleção cuidada",
      }),
    ).toBe(PT);
    expect(
      resolveHomeDocumentTitle({
        seoTitle: RU,
        siteDefaultTitle: null,
        fallbackTitle: "Synarava | Кураторские товары",
      }),
    ).toBe(RU);
  });

  it("composes a page SEO title that omits the brand suffix", () => {
    expect(
      resolveHomeDocumentTitle({
        seoTitle: "Jewellery & Accessories for Everyday Wear",
        siteDefaultTitle: null,
        fallbackTitle: EN,
      }),
    ).toBe(EN);
  });

  it("falls through to localized home.metaTitle when seoTitle is empty", () => {
    expect(
      resolveHomeDocumentTitle({
        seoTitle: "",
        siteDefaultTitle: "Synarava | Curated Goods",
        fallbackTitle: EN,
      }),
    ).toBe(EN);
    expect(
      resolveHomeDocumentTitle({
        seoTitle: "   ",
        siteDefaultTitle: null,
        fallbackTitle: PT,
      }),
    ).toBe(PT);
  });

  it("keeps a legacy brand-first absolute title without doubling the brand", () => {
    expect(
      resolveHomeDocumentTitle({
        seoTitle: "Synarava | TODAY, THIS.",
        siteDefaultTitle: EN,
        fallbackTitle: EN,
      }),
    ).toBe("Synarava | TODAY, THIS.");
  });

  it("ignores bare H1 slogans and uses the localized fallback instead", () => {
    expect(
      resolveHomeDocumentTitle({
        seoTitle: "TODAY, THIS.",
        siteDefaultTitle: "Synarava | Curated Goods",
        fallbackTitle: EN,
      }),
    ).toBe(EN);
  });
});
