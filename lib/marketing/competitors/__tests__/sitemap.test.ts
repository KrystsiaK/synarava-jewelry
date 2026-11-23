import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { collectProductUrlsFromSitemap, extractLocs } from "@/lib/marketing/competitors/sitemap";
import { parseRobotsTxt } from "@/lib/marketing/competitors/robots";
import type { CompetitorTarget } from "@/lib/marketing/competitors/targets";

const target: CompetitorTarget = {
  host: "aurorajoalharia.com",
  origin: "https://aurorajoalharia.com",
  productPath: /\/products\/[^/]+\/?$/i,
  label: "Aurora",
  tier: "small",
};

describe("sitemap", () => {
  it("extracts locs and walks index with product sitemaps first", async () => {
    const index = `<?xml version="1.0"?>
<sitemapindex>
  <sitemap><loc>https://aurorajoalharia.com/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>https://aurorajoalharia.com/sitemap-products.xml</loc></sitemap>
</sitemapindex>`;
    const products = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://aurorajoalharia.com/products/a</loc></url>
  <url><loc>https://aurorajoalharia.com/about</loc></url>
</urlset>`;
    const pages = `<?xml version="1.0"?><urlset><url><loc>https://aurorajoalharia.com/blog</loc></url></urlset>`;

    const order: string[] = [];
    const fetchFn = async (url: string) => {
      order.push(url);
      if (url.endsWith("sitemap.xml")) {
        return { status: 200, body: Buffer.from(index), finalUrl: url };
      }
      if (url.includes("products")) {
        return { status: 200, body: Buffer.from(products), finalUrl: url };
      }
      return { status: 200, body: Buffer.from(pages), finalUrl: url };
    };

    const robots = parseRobotsTxt(
      "User-agent: *\nAllow: /\nSitemap: https://aurorajoalharia.com/sitemap.xml\n",
    );
    const result = await collectProductUrlsFromSitemap({ target, robots, fetchFn });
    expect(result.sitemapOk).toBe(true);
    expect(result.productUrls).toEqual(["https://aurorajoalharia.com/products/a"]);
    const productIdx = order.findIndex((u) => u.includes("sitemap-products"));
    const pagesIdx = order.findIndex((u) => u.includes("sitemap-pages"));
    expect(productIdx).toBeGreaterThan(-1);
    expect(pagesIdx).toBeGreaterThan(-1);
    expect(productIdx).toBeLessThan(pagesIdx);
  });

  it("supports .gz product sitemaps", async () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://aurorajoalharia.com/products/gz-item</loc></url></urlset>`;
    const gz = gzipSync(Buffer.from(xml));
    const robots = parseRobotsTxt("User-agent: *\nAllow: /\n");
    const result = await collectProductUrlsFromSitemap({
      target,
      robots,
      fetchFn: async (url) => {
        if (url.endsWith("/sitemap.xml")) {
          return {
            status: 200,
            body: Buffer.from(
              `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://aurorajoalharia.com/product-sitemap.xml.gz</loc></sitemap></sitemapindex>`,
            ),
            finalUrl: url,
          };
        }
        return { status: 200, body: gz, finalUrl: url };
      },
    });
    expect(result.productUrls).toContain("https://aurorajoalharia.com/products/gz-item");
  });

  it("extractLocs decodes amp entities", () => {
    expect(extractLocs("<loc>https://x.com/a?b=1&amp;c=2</loc>")).toEqual([
      "https://x.com/a?b=1&c=2",
    ]);
  });
});
