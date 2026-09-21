import type { MetadataRoute } from "next";
import { listCollections, listShopProducts } from "@/lib/content/catalog";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

type RouteEntry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  lastModified?: Date;
};

function withLocales(
  baseUrl: string,
  entry: RouteEntry,
  routeSegments: string[],
  defaultSegment: string,
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    routeSegments.map((segment) => [segment, `${baseUrl}/${segment}${entry.path}`]),
  );
  languages["x-default"] = `${baseUrl}/${defaultSegment}${entry.path}`;

  return routeSegments.map((segment) => ({
    url: `${baseUrl}/${segment}${entry.path}`,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getPublicSiteUrl();
  const locales = await getPublishedStorefrontLocales();
  const routeSegments = locales.map((locale) => locale.routeSegment);
  const defaultSegment = locales.find((locale) => locale.isDefault)?.routeSegment ?? "en";

  const staticEntries: RouteEntry[] = [
    { path: "", changeFrequency: "weekly", priority: 1.0 },
    { path: "/shop", changeFrequency: "daily", priority: 0.9 },
    { path: "/collections", changeFrequency: "weekly", priority: 0.8 },
    { path: "/about", changeFrequency: "monthly", priority: 0.6 },
    { path: "/care", changeFrequency: "monthly", priority: 0.5 },
    { path: "/shipping", changeFrequency: "monthly", priority: 0.5 },
    { path: "/returns", changeFrequency: "monthly", priority: 0.5 },
    { path: "/faq", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.4 },
    { path: "/offer", changeFrequency: "monthly", priority: 0.4 },
    { path: "/terms-and-conditions", changeFrequency: "monthly", priority: 0.4 },
    { path: "/legal-notice", changeFrequency: "monthly", priority: 0.4 },
    { path: "/dispute-resolution", changeFrequency: "yearly", priority: 0.3 },
  ];

  let dynamicEntries: RouteEntry[] = [];

  try {
    const [collections, products] = await Promise.all([
      listCollections(),
      listShopProducts(),
    ]);

    dynamicEntries = [
      ...collections.map((c) => ({
        path: `/collections/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...products.map((p) => ({
        path: `/products/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.9,
      })),
    ];
  } catch {
    // DB unavailable — omit dynamic routes
  }

  return [...staticEntries, ...dynamicEntries].flatMap((entry) =>
    withLocales(baseUrl, entry, routeSegments, defaultSegment));
}
