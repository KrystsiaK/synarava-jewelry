import { describe, expect, it } from "vitest";

import {
  resolveSerpDescription,
  resolveSerpTitle,
  seoDescriptionWarning,
  seoTitleWarning,
  serpDisplayUrl,
  SEO_DESCRIPTION_SOFT_MAX,
  SEO_TITLE_SOFT_MAX,
} from "../serp-preview";

describe("resolveSerpTitle", () => {
  it("prefers seo title, then fallbacks, then Untitled", () => {
    expect(resolveSerpTitle("SEO", "Name")).toBe("SEO");
    expect(resolveSerpTitle("  ", "Name")).toBe("Name");
    expect(resolveSerpTitle("", "", "")).toBe("Untitled");
  });
});

describe("resolveSerpDescription", () => {
  it("prefers seo description then fallbacks, stripping rich text", () => {
    expect(resolveSerpDescription("Seo desc", "Excerpt")).toBe("Seo desc");
    expect(resolveSerpDescription("<p>Seo <strong>desc</strong></p>", "Excerpt")).toBe(
      "Seo desc",
    );
    expect(resolveSerpDescription("", "Excerpt")).toBe("Excerpt");
    expect(resolveSerpDescription(null)).toBe("");
  });
});

describe("serpDisplayUrl", () => {
  it("builds a host › path crumb line", () => {
    expect(serpDisplayUrl("synarava.com", "/en/products/ring")).toBe(
      "synarava.com › en › products › ring",
    );
    expect(serpDisplayUrl("https://synarava.com/", "/pt/shop")).toBe(
      "synarava.com › pt › shop",
    );
    expect(serpDisplayUrl("", "/products/ring")).toBe("/products/ring");
  });
});

describe("seo length warnings", () => {
  it("warns only past soft limits, counting plain text", () => {
    expect(seoTitleWarning("a".repeat(SEO_TITLE_SOFT_MAX))).toBeUndefined();
    expect(seoTitleWarning("a".repeat(SEO_TITLE_SOFT_MAX + 1))).toMatch(/soft limit 60/);
    expect(seoDescriptionWarning("a".repeat(SEO_DESCRIPTION_SOFT_MAX))).toBeUndefined();
    expect(seoDescriptionWarning("a".repeat(SEO_DESCRIPTION_SOFT_MAX + 1))).toMatch(
      /soft limit 160/,
    );
    expect(
      seoDescriptionWarning(`<p>${"a".repeat(SEO_DESCRIPTION_SOFT_MAX)}</p>`),
    ).toBeUndefined();
  });
});
