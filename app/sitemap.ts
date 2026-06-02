import type { MetadataRoute } from "next";
import { listCollections, listShopProducts } from "@/lib/content/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/shop`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/collections`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/about/manifesto`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  let collectionRoutes: MetadataRoute.Sitemap = [];
  let productRoutes: MetadataRoute.Sitemap = [];

  try {
    const [collections, products] = await Promise.all([listCollections(), listShopProducts()]);

    collectionRoutes = collections.map((c) => ({
      url: `${baseUrl}/collections/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    productRoutes = products.map((p) => ({
      url: `${baseUrl}/products/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    }));
  } catch {
    // DB unavailable — omit dynamic routes
  }

  return [...staticRoutes, ...collectionRoutes, ...productRoutes];
}
