import type { MetadataRoute } from "next";
import { listCollections, listShopProducts } from "@/lib/content/catalog";
import { listPublishedPosts } from "@/lib/content/posts";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";

type RouteEntry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  lastModified?: Date;
};

function withLocales(baseUrl: string, entry: RouteEntry): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map(({ code }) => [code, `${baseUrl}/${code}${entry.path}`]),
  );
  languages["x-default"] = `${baseUrl}/en${entry.path}`;

  return SUPPORTED_LOCALES.map(({ code }) => ({
    url: `${baseUrl}/${code}${entry.path}`,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const staticEntries: RouteEntry[] = [
    { path: "", changeFrequency: "weekly", priority: 1.0 },
    { path: "/shop", changeFrequency: "daily", priority: 0.9 },
    { path: "/collections", changeFrequency: "weekly", priority: 0.8 },
    { path: "/journal", changeFrequency: "weekly", priority: 0.7 },
    { path: "/about", changeFrequency: "monthly", priority: 0.6 },
    { path: "/care", changeFrequency: "monthly", priority: 0.5 },
    { path: "/shipping", changeFrequency: "monthly", priority: 0.5 },
    { path: "/returns", changeFrequency: "monthly", priority: 0.5 },
    { path: "/faq", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.4 },
    { path: "/offer", changeFrequency: "monthly", priority: 0.4 },
  ];

  let dynamicEntries: RouteEntry[] = [];

  try {
    const [collections, products, posts] = await Promise.all([
      listCollections(),
      listShopProducts(),
      listPublishedPosts("en"),
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
      ...posts.map((post) => ({
        path: `/journal/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    // DB unavailable — omit dynamic routes
  }

  return [...staticEntries, ...dynamicEntries].flatMap((entry) => withLocales(baseUrl, entry));
}
