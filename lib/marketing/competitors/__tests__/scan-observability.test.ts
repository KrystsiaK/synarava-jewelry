import { describe, expect, it, vi } from "vitest";

import {
  truncateScanErrors,
} from "@/lib/marketing/competitors/collect";
import {
  collectProductUrlsFromSitemap,
  preferRobotsSitemaps,
} from "@/lib/marketing/competitors/sitemap";
import { parseRobotsTxt } from "@/lib/marketing/competitors/robots";
import type { CompetitorTarget } from "@/lib/marketing/competitors/targets";
import { COMPETITOR_TARGETS } from "@/lib/marketing/competitors/targets";

const aurora: CompetitorTarget = {
  host: "aurorajoalharia.com",
  origin: "https://aurorajoalharia.com",
  productPath: /\/products\/[^/]+\/?$/i,
  label: "Aurora",
  tier: "small",
};

describe("truncateScanErrors", () => {
  it("keeps first 3 and caps each at 200 chars", () => {
    const long = "x".repeat(250);
    const out = truncateScanErrors([long, "b", "c", "d"]);
    expect(out).toHaveLength(3);
    expect(out[0]?.length).toBe(200);
    expect(out[0]?.endsWith("…")).toBe(true);
    expect(out[1]).toBe("b");
    expect(out[2]).toBe("c");
  });
});

describe("preferRobotsSitemaps", () => {
  it("filters to path-prefer matches when any exist", () => {
    const all = [
      "https://www.parfois.com/es/es/sitemap_index.xml",
      "https://www.parfois.com/pt/pt/sitemap_index.xml",
      "https://www.parfois.com/en/gb/sitemap_index.xml",
    ];
    expect(preferRobotsSitemaps(all, "/pt/pt/")).toEqual([
      "https://www.parfois.com/pt/pt/sitemap_index.xml",
    ]);
  });

  it("falls back to all when prefer matches none", () => {
    const all = ["https://www.parfois.com/es/es/sitemap_index.xml"];
    expect(preferRobotsSitemaps(all, "/pt/pt/")).toEqual(all);
  });

  it("parfois target declares /pt/pt/ prefer", () => {
    const parfois = COMPETITOR_TARGETS.find((t) => t.host === "parfois.com");
    expect(parfois?.sitemapPathPrefer).toBe("/pt/pt/");
  });
});

describe("sitemap walk resilience", () => {
  it("oversized/throwing child does not abort the whole walk", async () => {
    const robots = parseRobotsTxt(
      [
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://aurorajoalharia.com/sitemap.xml",
      ].join("\n"),
    );
    const index = `<?xml version="1.0"?><sitemapindex>
      <sitemap><loc>https://aurorajoalharia.com/sitemap_products_1.xml</loc></sitemap>
      <sitemap><loc>https://aurorajoalharia.com/sitemap_products_2.xml</loc></sitemap>
    </sitemapindex>`;
    const child2 = `<?xml version="1.0"?><urlset>
      <url><loc>https://aurorajoalharia.com/products/ok</loc></url>
    </urlset>`;

    const result = await collectProductUrlsFromSitemap({
      target: aurora,
      robots,
      fetchFn: async (url) => {
        if (url.endsWith("/sitemap.xml")) {
          return { status: 200, body: Buffer.from(index), finalUrl: url };
        }
        if (url.includes("sitemap_products_1")) {
          throw new Error("Response exceeds 3145728 bytes");
        }
        if (url.includes("sitemap_products_2")) {
          return { status: 200, body: Buffer.from(child2), finalUrl: url };
        }
        return { status: 404, body: Buffer.alloc(0), finalUrl: url };
      },
    });

    expect(result.sitemapOk).toBe(true);
    expect(result.productUrls).toEqual([
      "https://aurorajoalharia.com/products/ok",
    ]);
    expect(result.complete).toBe(false);
  });

  it("path prefer skips unrelated locale indexes", async () => {
    const parfois = COMPETITOR_TARGETS.find((t) => t.host === "parfois.com")!;
    const robots = parseRobotsTxt(
      [
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://www.parfois.com/es/es/sitemap_index.xml",
        "Sitemap: https://www.parfois.com/pt/pt/sitemap_index.xml",
      ].join("\n"),
    );
    const ptIndex = `<?xml version="1.0"?><sitemapindex>
      <sitemap><loc>https://www.parfois.com/pt/pt/sitemap_0-product.xml</loc></sitemap>
    </sitemapindex>`;
    const ptProducts = `<?xml version="1.0"?><urlset>
      <url><loc>https://www.parfois.com/pt/pt/bijuteria/brincos/a.html</loc></url>
      <url><loc>https://www.parfois.com/pt/pt/bijuteria/basicos/comprar-o-look/x.html</loc></url>
    </urlset>`;

    const fetched: string[] = [];
    const result = await collectProductUrlsFromSitemap({
      target: parfois,
      robots,
      fetchFn: async (url) => {
        fetched.push(url);
        if (url.includes("/es/es/")) {
          throw new Error("should not fetch es locale");
        }
        if (url.endsWith("/pt/pt/sitemap_index.xml")) {
          return { status: 200, body: Buffer.from(ptIndex), finalUrl: url };
        }
        if (url.includes("sitemap_0-product")) {
          return { status: 200, body: Buffer.from(ptProducts), finalUrl: url };
        }
        return { status: 404, body: Buffer.alloc(0), finalUrl: url };
      },
    });

    expect(fetched.some((u) => u.includes("/es/es/"))).toBe(false);
    expect(result.productUrls).toEqual([
      "https://www.parfois.com/pt/pt/bijuteria/brincos/a.html",
    ]);
    expect(result.complete).toBe(true);
  });
});

void vi;
