import { describe, expect, it } from "vitest";

import { SITE_SEO_DEFAULTS } from "@/lib/content/site-seo-fields";
import {
  composeDocumentTitle,
  metadataDocumentTitle,
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
