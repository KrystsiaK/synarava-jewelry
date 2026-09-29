import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetaHealthPanel } from "@/components/admin/meta/meta-health-panel";
import type { MetaHealthReport } from "@/lib/seo/meta-health";

const report: MetaHealthReport = {
  siteUrl: "https://synarava.com",
  siteUrlConfigured: true,
  robotsUrl: "https://synarava.com/robots.txt",
  sitemapUrl: "https://synarava.com/sitemap.xml",
  checks: [
    {
      id: "robots",
      label: "robots.txt",
      tone: "ok",
      detail: "Storefront serves robots.",
      href: "https://synarava.com/robots.txt",
      external: true,
    },
    {
      id: "coverage-products",
      label: "Products SEO title coverage",
      tone: "partial",
      detail: "1/2 published have an explicit SEO title.",
      href: "/admin/products",
    },
  ],
  coverage: [
    {
      kind: "products",
      label: "Products",
      published: 2,
      withSeoTitle: 1,
      missingSeoTitle: 1,
      adminListHref: "/admin/products",
      samplesMissing: [{ id: "p1", label: "Lava ring", adminHref: "/admin/products/p1" }],
    },
    {
      kind: "collections",
      label: "Collections",
      published: 0,
      withSeoTitle: 0,
      missingSeoTitle: 0,
      adminListHref: "/admin/collections",
      samplesMissing: [],
    },
    {
      kind: "pages",
      label: "Pages",
      published: 1,
      withSeoTitle: 1,
      missingSeoTitle: 0,
      adminListHref: "/admin/pages",
      samplesMissing: [],
    },
  ],
  imageAltCoverage: {
    publishedWithMedia: 2,
    withGoodAlt: 1,
    samplesMissing: [
      { id: "p2", label: "Pearl necklace", adminHref: "/admin/products/p2#field-imageUrl" },
    ],
  },
  richResultsSamples: [
    {
      label: "Lava ring",
      storefrontUrl: "https://synarava.com/en/products/lava-ring",
      testUrl: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fsynarava.com%2Fen%2Fproducts%2Flava-ring",
    },
  ],
};

describe("MetaHealthPanel", () => {
  it("renders checklist, coverage samples, and Rich Results links", () => {
    render(<MetaHealthPanel report={report} />);

    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /robots\.txt/i })).toHaveAttribute(
      "href",
      "https://synarava.com/robots.txt",
    );
    expect(screen.getByRole("link", { name: "Lava ring" })).toHaveAttribute(
      "href",
      "/admin/products/p1",
    );
    expect(screen.getByRole("link", { name: /Test as Google/i })).toHaveAttribute(
      "href",
      report.richResultsSamples[0].testUrl,
    );
    expect(screen.getAllByText("1/2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "Image alt" })).toHaveAttribute("href", "/admin/products");
    expect(screen.getByRole("link", { name: "Pearl necklace" })).toHaveAttribute(
      "href",
      "/admin/products/p2#field-imageUrl",
    );
  });
});
