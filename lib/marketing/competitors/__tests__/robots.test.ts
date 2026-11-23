import { describe, expect, it } from "vitest";

import { parseRobotsTxt } from "@/lib/marketing/competitors/robots";

describe("parseRobotsTxt", () => {
  it("uses longest-match Allow/Disallow for * group", () => {
    const policy = parseRobotsTxt(`
User-agent: *
Disallow: /products/
Allow: /products/ok
Crawl-delay: 2
Sitemap: https://example.com/sitemap.xml

User-agent: BadBot
Disallow: /
`);
    expect(policy.allowed("/products/secret")).toBe(false);
    expect(policy.allowed("/products/ok")).toBe(true);
    expect(policy.allowed("/about")).toBe(true);
    expect(policy.crawlDelaySeconds).toBe(2);
    expect(policy.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("defaults allow when no matching rule", () => {
    const policy = parseRobotsTxt("User-agent: *\nDisallow:\n");
    expect(policy.allowed("/anything")).toBe(true);
  });
});
