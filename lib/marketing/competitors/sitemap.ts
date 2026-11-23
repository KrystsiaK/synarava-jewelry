import { gunzipSync } from "node:zlib";

import type { RobotsPolicy } from "@/lib/marketing/competitors/robots";
import {
  findCompetitorTarget,
  isProductUrlForTarget,
  normalizeCompetitorHost,
  type CompetitorTarget,
} from "@/lib/marketing/competitors/targets";

export type FetchFn = (url: string) => Promise<{ status: number; body: Buffer; finalUrl: string }>;

export function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) =>
    (m[1] ?? "").replace(/&amp;/g, "&").trim(),
  );
}

function decodeBody(url: string, body: Buffer): string {
  if (url.toLowerCase().endsWith(".gz") || body[0] === 0x1f) {
    try {
      return gunzipSync(body).toString("utf8");
    } catch {
      return body.toString("utf8");
    }
  }
  return body.toString("utf8");
}

export type SitemapCollectResult = {
  productUrls: string[];
  sitemapsRead: number;
  /** True when at least one sitemap URL returned HTTP 200 with parseable XML. */
  sitemapOk: boolean;
};

/**
 * Walk sitemap index → product sitemaps first → product locs matching target regex.
 * Fallback queue: robots sitemaps, else `/sitemap.xml` then `/sitemap_index.xml`.
 */
export async function collectProductUrlsFromSitemap(input: {
  target: CompetitorTarget;
  robots: RobotsPolicy;
  fetchFn: FetchFn;
  maxSitemaps?: number;
  maxProducts?: number;
}): Promise<SitemapCollectResult> {
  const { target, robots, fetchFn } = input;
  const maxSitemaps = input.maxSitemaps ?? 15;
  const maxProducts = input.maxProducts ?? 400;

  const queue: string[] = robots.sitemaps.length
    ? [...robots.sitemaps]
    : [`${target.origin}/sitemap.xml`, `${target.origin}/sitemap_index.xml`];

  const seen = new Set<string>();
  const products: string[] = [];
  let sitemapOk = false;

  while (queue.length > 0 && products.length < maxProducts && seen.size < maxSitemaps) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);

    let smUrl: URL;
    try {
      smUrl = new URL(sm);
    } catch {
      continue;
    }
    if (normalizeCompetitorHost(smUrl.hostname) !== target.host) continue;
    if (!robots.allowed(smUrl.pathname)) continue;

    const res = await fetchFn(sm);
    if (res.status !== 200) continue;
    const text = decodeBody(sm, res.body);
    if (!/<urlset|<sitemapindex/i.test(text)) continue;
    sitemapOk = true;

    const locs = extractLocs(text);
    if (/<sitemapindex/i.test(text)) {
      const productFirst = locs.filter((u) => /product/i.test(u));
      const rest = locs.filter((u) => !/product/i.test(u));
      queue.push(...productFirst, ...rest);
      continue;
    }

    for (const loc of locs) {
      try {
        const u = new URL(loc);
        if (normalizeCompetitorHost(u.hostname) !== target.host) continue;
        if (!isProductUrlForTarget(target, u.pathname)) continue;
        products.push(u.toString());
      } catch {
        // skip bad loc
      }
    }
  }

  return {
    productUrls: [...new Set(products)],
    sitemapsRead: seen.size,
    sitemapOk,
  };
}

export function resolveTargetFromOrigin(origin: string): CompetitorTarget | undefined {
  try {
    return findCompetitorTarget(new URL(origin).hostname);
  } catch {
    return undefined;
  }
}
