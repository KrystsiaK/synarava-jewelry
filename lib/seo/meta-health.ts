import "server-only";

import { cache } from "react";

import { getSiteSeoOverrides } from "@/lib/content/site-seo";
import { db } from "@/lib/db";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { localePath } from "@/lib/i18n/routing";
import {
  richResultsTestUrl,
  seoCoverageTone,
  type MetaHealthTone,
} from "@/lib/seo/meta-health-shared";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export type { MetaHealthTone };
export { seoCoverageTone, richResultsTestUrl } from "@/lib/seo/meta-health-shared";

export type MetaHealthCheck = {
  id: string;
  label: string;
  tone: MetaHealthTone;
  detail: string;
  /** Admin or storefront path / absolute URL. */
  href?: string;
  external?: boolean;
};

export type SeoCoverageMissingSample = {
  id: string;
  label: string;
  adminHref: string;
};

export type SeoCoverageBucket = {
  kind: "products" | "collections" | "pages";
  label: string;
  published: number;
  withSeoTitle: number;
  missingSeoTitle: number;
  adminListHref: string;
  samplesMissing: SeoCoverageMissingSample[];
};

export type RichResultsSample = {
  label: string;
  storefrontUrl: string;
  testUrl: string;
};

export type MetaHealthReport = {
  siteUrl: string;
  siteUrlConfigured: boolean;
  robotsUrl: string;
  sitemapUrl: string;
  checks: MetaHealthCheck[];
  coverage: SeoCoverageBucket[];
  richResultsSamples: RichResultsSample[];
};

const SAMPLE_LIMIT = 5;
const RICH_RESULTS_LIMIT = 3;

function hasSeoTitle(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function readSiteUrl(): { url: string; configured: boolean } {
  const configured = Boolean(process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL);
  try {
    return { url: getPublicSiteUrl(), configured };
  } catch {
    return { url: "", configured: false };
  }
}

/** Binary SEO health for /admin/meta — reads existing robots/sitemap + DB, no new knobs. */
export const getMetaHealthReport = cache(async (): Promise<MetaHealthReport> => {
  const { url: siteUrl, configured: siteUrlConfigured } = readSiteUrl();
  const robotsUrl = siteUrl ? `${siteUrl}/robots.txt` : "/robots.txt";
  const sitemapUrl = siteUrl ? `${siteUrl}/sitemap.xml` : "/sitemap.xml";

  const [overrides, locales, products, collections, pages] = await Promise.all([
    getSiteSeoOverrides(),
    getPublishedStorefrontLocales(),
    db.product.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC" },
      select: { id: true, name: true, slug: true, seoTitle: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.collection.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC" },
      select: { id: true, name: true, slug: true, seoTitle: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.page.findMany({
      where: { status: "PUBLISHED", visibility: "PUBLIC" },
      select: { id: true, title: true, slug: true, seoTitle: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const defaultSegment = locales.find((locale) => locale.isDefault)?.routeSegment ?? "en";
  const overrideCount = Object.keys(overrides).length;

  const productCoverage: SeoCoverageBucket = {
    kind: "products",
    label: "Products",
    published: products.length,
    withSeoTitle: products.filter((row) => hasSeoTitle(row.seoTitle)).length,
    missingSeoTitle: products.filter((row) => !hasSeoTitle(row.seoTitle)).length,
    adminListHref: "/admin/products",
    samplesMissing: products
      .filter((row) => !hasSeoTitle(row.seoTitle))
      .slice(0, SAMPLE_LIMIT)
      .map((row) => ({
        id: row.id,
        label: row.name,
        adminHref: `/admin/products/${row.id}`,
      })),
  };

  const collectionCoverage: SeoCoverageBucket = {
    kind: "collections",
    label: "Collections",
    published: collections.length,
    withSeoTitle: collections.filter((row) => hasSeoTitle(row.seoTitle)).length,
    missingSeoTitle: collections.filter((row) => !hasSeoTitle(row.seoTitle)).length,
    adminListHref: "/admin/collections",
    samplesMissing: collections
      .filter((row) => !hasSeoTitle(row.seoTitle))
      .slice(0, SAMPLE_LIMIT)
      .map((row) => ({
        id: row.id,
        label: row.name,
        adminHref: `/admin/collections/${row.id}`,
      })),
  };

  const pageCoverage: SeoCoverageBucket = {
    kind: "pages",
    label: "Pages",
    published: pages.length,
    withSeoTitle: pages.filter((row) => hasSeoTitle(row.seoTitle)).length,
    missingSeoTitle: pages.filter((row) => !hasSeoTitle(row.seoTitle)).length,
    adminListHref: "/admin/pages",
    samplesMissing: pages
      .filter((row) => !hasSeoTitle(row.seoTitle))
      .slice(0, SAMPLE_LIMIT)
      .map((row) => ({
        id: row.id,
        label: row.title,
        adminHref: `/admin/pages/${row.slug}`,
      })),
  };

  const coverage = [productCoverage, collectionCoverage, pageCoverage];

  const checks: MetaHealthCheck[] = [
    {
      id: "site-url",
      label: "Public site URL",
      tone: siteUrlConfigured ? "ok" : "warn",
      detail: siteUrlConfigured
        ? siteUrl
        : "APP_URL / NEXT_PUBLIC_SITE_URL not set — sitemap and canonicals use a local fallback.",
      href: siteUrl || undefined,
      external: Boolean(siteUrl),
    },
    {
      id: "robots",
      label: "robots.txt",
      tone: "ok",
      detail: "Storefront serves robots with sitemap pointer and admin/cart disallow rules.",
      href: robotsUrl,
      external: robotsUrl.startsWith("http"),
    },
    {
      id: "sitemap",
      label: "sitemap.xml",
      tone: "ok",
      detail: "Dynamic sitemap includes locales, products, collections, and published CMS pages.",
      href: sitemapUrl,
      external: sitemapUrl.startsWith("http"),
    },
    {
      id: "site-defaults",
      label: "Site-wide SEO defaults",
      tone: overrideCount > 0 ? "ok" : "partial",
      detail:
        overrideCount > 0
          ? `${overrideCount} custom field${overrideCount === 1 ? "" : "s"} saved in /admin/meta.`
          : "Using shipped defaults — optional to customize title template and OG copy below.",
      href: "#site-seo-defaults",
    },
    ...coverage.map((bucket) => ({
      id: `coverage-${bucket.kind}`,
      label: `${bucket.label} SEO title coverage`,
      tone: seoCoverageTone(bucket),
      detail:
        bucket.published === 0
          ? `No published ${bucket.kind} yet.`
          : `${bucket.withSeoTitle}/${bucket.published} published have an explicit SEO title (blank falls back to name/title).`,
      href: bucket.adminListHref,
    })),
  ];

  const richResultsSamples: RichResultsSample[] =
    siteUrlConfigured && siteUrl
      ? products.slice(0, RICH_RESULTS_LIMIT).map((row) => {
          const storefrontUrl = `${siteUrl}${localePath(defaultSegment, `/products/${row.slug}`)}`;
          return {
            label: row.name,
            storefrontUrl,
            testUrl: richResultsTestUrl(storefrontUrl),
          };
        })
      : [];

  return {
    siteUrl,
    siteUrlConfigured,
    robotsUrl,
    sitemapUrl,
    checks,
    coverage,
    richResultsSamples,
  };
});
