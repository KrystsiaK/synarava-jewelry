import { gunzipSync } from "node:zlib";

import type { RobotsPolicy } from "@/lib/marketing/competitors/robots";
import {
  findCompetitorTarget,
  isProductUrlForTarget,
  normalizeCompetitorHost,
  type CompetitorTarget,
} from "@/lib/marketing/competitors/targets";

export type FetchFn = (url: string) => Promise<{ status: number; body: Buffer; finalUrl: string }>;

/** Cap decompressed sitemap size (gzip bomb guard). */
export const SITEMAP_MAX_GUNZIP_BYTES = 10 * 1024 * 1024;

export function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) =>
    (m[1] ?? "").replace(/&amp;/g, "&").trim(),
  );
}

/**
 * Decode sitemap body. Gzip errors / oversize throw — caller must not mark sitemapOk.
 */
export function decodeSitemapBody(url: string, body: Buffer): string {
  if (url.toLowerCase().endsWith(".gz") || body[0] === 0x1f) {
    return gunzipSync(body, { maxOutputLength: SITEMAP_MAX_GUNZIP_BYTES }).toString(
      "utf8",
    );
  }
  return body.toString("utf8");
}

export type SitemapCollectResult = {
  productUrls: string[];
  sitemapsRead: number;
  /** True when at least one sitemap URL returned HTTP 200 with parseable XML. */
  sitemapOk: boolean;
  /**
   * False when truncated, a required sitemap failed, or nothing usable was read.
   * Only the initial fallback seeds (`/sitemap.xml`, `/sitemap_index.xml` when
   * robots lists none) may fail without breaking completeness.
   * Removal-from-sitemap must only run when complete === true.
   */
  complete: boolean;
};

/** Prefer locale-scoped robots Sitemap entries when the target declares a hint. */
export function preferRobotsSitemaps(
  sitemaps: readonly string[],
  pathPrefer: string | undefined,
): string[] {
  if (!pathPrefer) return [...sitemaps];
  const preferred = sitemaps.filter((u) => u.includes(pathPrefer));
  return preferred.length > 0 ? preferred : [...sitemaps];
}

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

  const usedRobotsSitemaps = robots.sitemaps.length > 0;
  const seedQueue: string[] = usedRobotsSitemaps
    ? preferRobotsSitemaps(robots.sitemaps, target.sitemapPathPrefer)
    : [`${target.origin}/sitemap.xml`, `${target.origin}/sitemap_index.xml`];

  // Optional: only the synthetic fallback seeds may 404 without failing completeness.
  // Robots-listed sitemaps and every URL discovered from a sitemapindex are required.
  const optionalSeeds = new Set(
    usedRobotsSitemaps
      ? []
      : [`${target.origin}/sitemap.xml`, `${target.origin}/sitemap_index.xml`],
  );

  const queue: string[] = [...seedQueue];
  const seen = new Set<string>();
  const products: string[] = [];
  let sitemapOk = false;
  let truncated = false;
  let requiredFailed = false;

  while (queue.length > 0) {
    if (products.length >= maxProducts || seen.size >= maxSitemaps) {
      truncated = true;
      break;
    }

    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);

    const required = !optionalSeeds.has(sm);

    let smUrl: URL;
    try {
      smUrl = new URL(sm);
    } catch {
      if (required) requiredFailed = true;
      continue;
    }
    if (normalizeCompetitorHost(smUrl.hostname) !== target.host) {
      if (required) requiredFailed = true;
      continue;
    }
    if (!robots.allowed(smUrl.pathname)) {
      if (required) requiredFailed = true;
      continue;
    }

    let res: { status: number; body: Buffer; finalUrl: string };
    try {
      res = await fetchFn(sm);
    } catch {
      // Oversized body / network / SSRF — do not abort the whole walk.
      if (required) requiredFailed = true;
      continue;
    }
    if (res.status !== 200) {
      if (required) requiredFailed = true;
      continue;
    }

    let text: string;
    try {
      text = decodeSitemapBody(sm, res.body);
    } catch {
      // Gzip bomb / corrupt gzip
      if (required) requiredFailed = true;
      continue;
    }
    if (!/<urlset|<sitemapindex/i.test(text)) {
      if (required) requiredFailed = true;
      continue;
    }
    sitemapOk = true;

    const locs = extractLocs(text);
    if (/<sitemapindex/i.test(text)) {
      const productFirst = locs.filter((u) => /product/i.test(u));
      const rest = locs.filter((u) => !/product/i.test(u));
      // Children of an index are always required.
      queue.push(...productFirst, ...rest);
      continue;
    }

    for (const loc of locs) {
      if (products.length >= maxProducts) {
        truncated = true;
        break;
      }
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

  if (queue.length > 0) {
    truncated = true;
  }

  const unique = [...new Set(products)];
  const complete = sitemapOk && !truncated && !requiredFailed;

  return {
    productUrls: unique.slice(0, maxProducts),
    sitemapsRead: seen.size,
    sitemapOk,
    complete,
  };
}

export function resolveTargetFromOrigin(origin: string): CompetitorTarget | undefined {
  try {
    return findCompetitorTarget(new URL(origin).hostname);
  } catch {
    return undefined;
  }
}
