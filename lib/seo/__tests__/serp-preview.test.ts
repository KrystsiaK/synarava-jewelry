import { describe, expect, it } from "vitest";

import {
  defaultSerpHost,
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

describe("defaultSerpHost", () => {
  it("maps loopback APP_URL to the public SERP host", () => {
    const prevApp = process.env.APP_URL;
    const prevPublic = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.APP_URL = "http://localhost:3000";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      expect(defaultSerpHost()).toBe("synarava.com");
    } finally {
      if (prevApp === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevApp;
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevPublic;
    }
  });
});
