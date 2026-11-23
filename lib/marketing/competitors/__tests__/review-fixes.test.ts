import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

import { isBlockedResolvedIp } from "@/lib/marketing/competitors/fetch";
import { selectUrlsToFetch } from "@/lib/marketing/competitors/select-urls";
import {
  collectProductUrlsFromSitemap,
  decodeSitemapBody,
} from "@/lib/marketing/competitors/sitemap";
import { parseRobotsTxt } from "@/lib/marketing/competitors/robots";
import type { CompetitorTarget } from "@/lib/marketing/competitors/targets";
import { validateManualNotes } from "@/lib/marketing/ideas/notes";

const target: CompetitorTarget = {
  host: "aurorajoalharia.com",
  origin: "https://aurorajoalharia.com",
  productPath: /\/products\/[^/]+\/?$/i,
  label: "Aurora",
  tier: "small",
};

describe("fix2 gzip bomb", () => {
  it("rejects oversized gunzip (no huge allocation)", () => {
    // Payload expands past SITEMAP_MAX_GUNZIP_BYTES (10 MiB); gzip stays small.
    const huge = Buffer.alloc(12 * 1024 * 1024, 0x20);
    const gz = gzipSync(huge);
    expect(gz.byteLength).toBeLessThan(100 * 1024);
    expect(() =>
      decodeSitemapBody("https://aurorajoalharia.com/sitemap.xml.gz", gz),
    ).toThrow();
  });

  it("failed gzip does not mark sitemapOk", async () => {
    const huge = Buffer.alloc(12 * 1024 * 1024, 0x20);
    const gz = gzipSync(huge);
    const robots = parseRobotsTxt(
      "User-agent: *\nAllow: /\nSitemap: https://aurorajoalharia.com/product-sitemap.xml.gz\n",
    );
    const result = await collectProductUrlsFromSitemap({
      target,
      robots,
      fetchFn: async (url) => ({
        status: 200,
        body: url.endsWith(".gz") ? gz : Buffer.from(""),
        finalUrl: url,
      }),
    });
    expect(result.sitemapOk).toBe(false);
    expect(result.complete).toBe(false);
    expect(result.productUrls).toEqual([]);
  });
});

describe("fix3 discovery budget", () => {
  it("fetches new sitemap URLs even when many prior URLs exist", () => {
    const prior = Array.from(
      { length: 30 },
      (_, i) => `https://aurorajoalharia.com/products/old-${i}`,
    );
    const neu = Array.from(
      { length: 5 },
      (_, i) => `https://aurorajoalharia.com/products/new-${i}`,
    );
    const selected = selectUrlsToFetch({
      priorActiveUrls: prior,
      newSitemapUrls: neu,
      maxFetches: 20,
      maxRevisit: 10,
      random: () => 0,
    });
    for (const u of neu) {
      expect(selected).toContain(u);
    }
    expect(selected.filter((u) => prior.includes(u)).length).toBeLessThanOrEqual(10);
    expect(selected.length).toBeLessThanOrEqual(20);
  });
});

describe("fix4 sitemap complete flag", () => {
  it("complete=false when maxProducts truncates; complete=true when fully read", async () => {
    const robots = parseRobotsTxt(
      "User-agent: *\nAllow: /\nSitemap: https://aurorajoalharia.com/sitemap.xml\n",
    );
    const urls = Array.from(
      { length: 5 },
      (_, i) =>
        `<url><loc>https://aurorajoalharia.com/products/p${i}</loc></url>`,
    ).join("");
    const xml = `<?xml version="1.0"?><urlset>${urls}</urlset>`;

    const truncated = await collectProductUrlsFromSitemap({
      target,
      robots,
      maxProducts: 2,
      fetchFn: async (url) => ({
        status: 200,
        body: Buffer.from(xml),
        finalUrl: url,
      }),
    });
    expect(truncated.sitemapOk).toBe(true);
    expect(truncated.complete).toBe(false);
    expect(truncated.productUrls.length).toBe(2);

    const full = await collectProductUrlsFromSitemap({
      target,
      robots,
      maxProducts: 50,
      fetchFn: async (url) => ({
        status: 200,
        body: Buffer.from(xml),
        finalUrl: url,
      }),
    });
    expect(full.complete).toBe(true);
    expect(full.productUrls.length).toBe(5);
  });
});

describe("fix5 manual notes", () => {
  it("rejects non-http(s), >5 notes, and overlong text", () => {
    expect(
      validateManualNotes([{ url: "ftp://x", text: "hi" }]).ok,
    ).toBe(false);
    expect(
      validateManualNotes(
        Array.from({ length: 6 }, (_, i) => ({
          url: `https://example.com/${i}`,
          text: "note",
        })),
      ).ok,
    ).toBe(false);
    expect(
      validateManualNotes([
        { url: "https://example.com/a", text: "x".repeat(2001) },
      ]).ok,
    ).toBe(false);
    expect(
      validateManualNotes([
        { url: "https://example.com/a", text: "ok note" },
      ]),
    ).toEqual({
      ok: true,
      notes: [{ url: "https://example.com/a", text: "ok note" }],
    });
  });
});

describe("fix7 IPv4-mapped blocking", () => {
  it("blocks ::ffff:127.0.0.1 and ::ffff:10.0.0.1", () => {
    expect(isBlockedResolvedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedResolvedIp("::ffff:10.0.0.1")).toBe(true);
    expect(isBlockedResolvedIp("::ffff:8.8.8.8")).toBe(false);
  });
});

// Silence unused vi in case other describes need it later
void vi;
