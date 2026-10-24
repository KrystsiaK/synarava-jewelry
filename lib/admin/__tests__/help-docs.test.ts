import { describe, expect, it } from "vitest";

import {
  HelpArticleFormatError,
  listHelpArticles,
  loadHelpArticle,
  parseHelpArticle,
} from "@/lib/admin/help-docs";

describe("admin help document loader", () => {
  it("loads an existing article from the allowlisted docs directory", async () => {
    const article = await loadHelpArticle("add-a-product");
    expect(article).toMatchObject({
      slug: "add-a-product",
      title: "Add a product",
      section: "Catalog",
      status: "draft",
      verifiedOn: null,
      updatedOn: "2026-10-23",
    });
    expect(article?.headings.map((heading) => heading.label)).toContain("Steps");
  });

  it("returns null for unknown slugs", async () => {
    await expect(loadHelpArticle("does-not-exist")).resolves.toBeNull();
  });

  it.each([
    "../add-a-product",
    "..",
    "%2e%2e%2fadd-a-product",
    "%252e%252e%252fadd-a-product",
    "add-a-product%2f..",
    "/add-a-product",
  ])("rejects traversal-shaped slug %s", async (slug) => {
    await expect(loadHelpArticle(slug)).resolves.toBeNull();
  });

  it("parses verified front matter and article headings", () => {
    expect(parseHelpArticle(`---
title: Check a product
section: Catalog
status: verified
verifiedOn: 2026-10-20
updatedOn: 2026-10-21
---

## Goal

Check it.`, "check-a-product")).toMatchObject({
      status: "verified",
      verifiedOn: "2026-10-20",
      updatedOn: "2026-10-21",
      headings: [{ id: "goal", label: "Goal" }],
    });
  });

  it("requires a verification date for verified articles", () => {
    expect(() => parseHelpArticle(`---
title: Check a product
section: Catalog
status: verified
verifiedOn:
updatedOn: 2026-10-21
---

Body`, "check-a-product")).toThrow(HelpArticleFormatError);
  });

  it("lists only lowercase article filenames and excludes the template", async () => {
    const articles = await listHelpArticles();
    const slugs = articles.map((article) => article.slug);
    expect(slugs).toContain("add-a-product");
    expect(slugs).toContain("sync-collections");
    expect(slugs).toContain("shopify-sync-button");
    expect(slugs).not.toContain("README");
  });
});
