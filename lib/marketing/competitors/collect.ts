import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { extractFromHtml, parseShopifyProductJs } from "@/lib/marketing/competitors/extract";
import { fetchCompetitorUrl, OffHostRedirectError } from "@/lib/marketing/competitors/fetch";
import { decideObservationDiff } from "@/lib/marketing/competitors/diff";
import { parseRobotsTxt } from "@/lib/marketing/competitors/robots";
import { selectUrlsToFetch } from "@/lib/marketing/competitors/select-urls";
import { collectProductUrlsFromSitemap } from "@/lib/marketing/competitors/sitemap";
import {
  COMPETITOR_TARGETS,
  type CompetitorTarget,
} from "@/lib/marketing/competitors/targets";
import { shouldSkipUnparsedExtraction } from "@/lib/marketing/competitors/unparsed";

const MAX_FETCHES_PER_DOMAIN = 20;
const MAX_REVISIT_PER_DOMAIN = 10;
const MIN_DELAY_MS = 1500;
const SCAN_BUDGET_MS = 90_000;

export type ScanDomainResult = {
  domain: string;
  label: string;
  fetched: number;
  skippedRobots: number;
  written: number;
  unparsed: number;
  sitemapComplete: boolean;
  /** First errors encountered (caller truncates for AuditLog). */
  errors: string[];
};

const SCAN_ERROR_MAX = 3;
const SCAN_ERROR_MAX_CHARS = 200;

/** Keep first N domain errors, each capped for AuditLog / UI. */
export function truncateScanErrors(
  errors: readonly string[],
  max = SCAN_ERROR_MAX,
  maxChars = SCAN_ERROR_MAX_CHARS,
): string[] {
  return errors.slice(0, max).map((e) =>
    e.length <= maxChars ? e : `${e.slice(0, maxChars - 1)}…`,
  );
}

function pushScanError(result: ScanDomainResult, message: string): void {
  if (result.errors.length >= SCAN_ERROR_MAX) return;
  const trimmed =
    message.length <= SCAN_ERROR_MAX_CHARS
      ? message
      : `${message.slice(0, SCAN_ERROR_MAX_CHARS - 1)}…`;
  result.errors.push(trimmed);
}

export type ScanResult = {
  domains: ScanDomainResult[];
  writtenTotal: number;
  unparsedTotal: number;
  durationMs: number;
  truncated: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decimalPrice(price: number | null): Prisma.Decimal | null {
  if (price == null || !Number.isFinite(price)) return null;
  return new Prisma.Decimal(price.toFixed(2));
}

async function latestByUrl(urls: string[]) {
  if (urls.length === 0) return new Map<string, { id: string; contentHash: string; kind: string }>();
  const rows = await db.competitorObservation.findMany({
    where: { url: { in: urls } },
    orderBy: { fetchedAt: "desc" },
    select: { id: true, url: true, contentHash: true, kind: true },
  });
  const map = new Map<string, { id: string; contentHash: string; kind: string }>();
  for (const row of rows) {
    if (!map.has(row.url)) map.set(row.url, row);
  }
  return map;
}

async function previouslyObservedUrls(domain: string): Promise<string[]> {
  const rows = await db.competitorObservation.findMany({
    where: { domain },
    distinct: ["url"],
    select: { url: true },
    orderBy: { fetchedAt: "desc" },
    take: 500,
  });
  return rows.map((r) => r.url);
}

async function scanDomain(
  target: CompetitorTarget,
  deadline: number,
): Promise<ScanDomainResult> {
  const result: ScanDomainResult = {
    domain: target.host,
    label: target.label,
    fetched: 0,
    skippedRobots: 0,
    written: 0,
    unparsed: 0,
    sitemapComplete: false,
    errors: [],
  };

  if (Date.now() >= deadline) return result;

  let robotsText = "";
  try {
    const robotsRes = await fetchCompetitorUrl(`${target.origin}/robots.txt`, target);
    robotsText = robotsRes.body.toString("utf8");
  } catch (error) {
    pushScanError(
      result,
      error instanceof Error ? error.message : "robots.txt fetch failed",
    );
  }
  const robots = parseRobotsTxt(robotsText);
  const delayMs = Math.max(MIN_DELAY_MS, robots.crawlDelaySeconds * 1000);

  let sitemapUrls: string[] = [];
  let sitemapOk = false;
  let sitemapComplete = false;
  try {
    const sm = await collectProductUrlsFromSitemap({
      target,
      robots,
      fetchFn: (url) => fetchCompetitorUrl(url, target),
    });
    sitemapUrls = sm.productUrls;
    sitemapOk = sm.sitemapOk;
    sitemapComplete = sm.complete;
    result.sitemapComplete = sitemapComplete;
    if (sitemapUrls.length === 0) {
      pushScanError(
        result,
        sitemapOk
          ? "sitemap read ok but 0 URLs matched product path"
          : "sitemap yielded 0 product URLs",
      );
    }
  } catch (error) {
    pushScanError(
      result,
      error instanceof Error ? error.message : "sitemap failed",
    );
  }

  const priorUrls = await previouslyObservedUrls(target.host);
  const sitemapSet = new Set(sitemapUrls);
  const known = new Set(priorUrls);
  const allKnown = [...new Set([...priorUrls, ...sitemapUrls])];
  const latest = await latestByUrl(allKnown);

  const priorActive = priorUrls.filter((url) => {
    const row = latest.get(url);
    return row != null && row.kind !== "removed";
  });
  const newSitemapUrls = sitemapUrls.filter((url) => !known.has(url));

  const toFetch = selectUrlsToFetch({
    priorActiveUrls: priorActive,
    newSitemapUrls,
    maxFetches: MAX_FETCHES_PER_DOMAIN,
    maxRevisit: MAX_REVISIT_PER_DOMAIN,
  });

  // Removed from sitemap only when the sitemap walk completed fully.
  if (sitemapOk && sitemapComplete) {
    for (const url of priorUrls) {
      if (sitemapSet.has(url)) continue;
      const decision = decideObservationDiff({
        prior: latest.get(url),
        removed: true,
      });
      if (!decision.write) continue;
      await db.competitorObservation.create({
        data: {
          domain: target.host,
          url,
          httpStatus: 410,
          source: "sitemap",
          name: null,
          price: null,
          currency: null,
          availability: null,
          contentHash: decision.contentHash,
          kind: decision.kind,
          previousId: decision.previousId,
        },
      });
      result.written += 1;
    }
  }

  for (const url of toFetch) {
    if (Date.now() >= deadline) break;

    let path: string;
    try {
      path = new URL(url).pathname;
    } catch {
      continue;
    }

    if (!robots.allowed(path)) {
      result.skippedRobots += 1;
      continue;
    }

    await sleep(delayMs);
    if (Date.now() >= deadline) break;

    let status = 0;
    let html = "";
    try {
      const res = await fetchCompetitorUrl(url, target);
      status = res.status;
      html = res.body.toString("utf8");
      result.fetched += 1;
    } catch (error) {
      if (error instanceof OffHostRedirectError) {
        pushScanError(result, error.message);
        continue;
      }
      pushScanError(
        result,
        error instanceof Error ? error.message : "fetch failed",
      );
      continue;
    }

    if (status === 403) {
      pushScanError(result, `HTTP 403 blocked: ${url}`);
      continue;
    }

    // Challenge / soft-block pages often return 200 with captcha markup and no product data.
    if (
      status === 200 &&
      /(?:cf-challenge|challenge-platform|attention required|<title[^>]*>[^<]*access denied)/i.test(
        html.slice(0, 8000),
      )
    ) {
      pushScanError(result, `Challenge/block page: ${url}`);
      continue;
    }

    if (status === 404 || status === 410) {
      const decision = decideObservationDiff({
        prior: latest.get(url),
        removed: true,
      });
      if (decision.write) {
        await db.competitorObservation.create({
          data: {
            domain: target.host,
            url,
            httpStatus: status,
            source: "sitemap",
            name: null,
            price: null,
            currency: null,
            availability: null,
            contentHash: decision.contentHash,
            kind: decision.kind,
            previousId: decision.previousId,
          },
        });
        result.written += 1;
      }
      continue;
    }

    if (status !== 200) {
      pushScanError(result, `HTTP ${status}: ${url}`);
      continue;
    }

    let extracted = extractFromHtml(html);
    if (
      extracted.price == null &&
      /\/products\/[^/]+\/?$/i.test(path) &&
      robots.allowed(`${path.endsWith("/") ? path.slice(0, -1) : path}.js`)
    ) {
      await sleep(delayMs);
      try {
        const jsUrl = url.replace(/\/?$/, "") + ".js";
        const jsRes = await fetchCompetitorUrl(jsUrl, target);
        result.fetched += 1;
        if (jsRes.status === 200) {
          const shopify = parseShopifyProductJs(jsRes.body.toString("utf8"));
          if (shopify) extracted = shopify;
        }
      } catch (error) {
        pushScanError(
          result,
          error instanceof Error ? error.message : "shopify-js failed",
        );
      }
    }

    if (shouldSkipUnparsedExtraction(extracted)) {
      result.unparsed += 1;
      continue;
    }

    const decision = decideObservationDiff({
      prior: latest.get(url),
      removed: false,
      name: extracted.name,
      price: extracted.price,
      currency: extracted.currency,
      availability: extracted.availability,
    });
    if (!decision.write) continue;

    await db.competitorObservation.create({
      data: {
        domain: target.host,
        url,
        httpStatus: status,
        source: extracted.source ?? "json-ld",
        name: extracted.name,
        price: decimalPrice(extracted.price),
        currency: extracted.currency,
        availability: extracted.availability,
        contentHash: decision.contentHash,
        kind: decision.kind,
        previousId: decision.previousId,
      },
    });
    result.written += 1;
  }

  return result;
}

/** Scan all allowlisted domains in parallel; per-domain sequential with delay. Whole scan ≤ 90s. */
export async function scanAllCompetitors(now = new Date()): Promise<ScanResult> {
  const started = now.getTime();
  const deadline = started + SCAN_BUDGET_MS;
  const domains = await Promise.all(
    COMPETITOR_TARGETS.map((target) => scanDomain(target, deadline)),
  );
  const durationMs = Date.now() - started;
  return {
    domains,
    writtenTotal: domains.reduce((sum, d) => sum + d.written, 0),
    unparsedTotal: domains.reduce((sum, d) => sum + d.unparsed, 0),
    durationMs,
    truncated: durationMs >= SCAN_BUDGET_MS - 50 || Date.now() >= deadline,
  };
}
