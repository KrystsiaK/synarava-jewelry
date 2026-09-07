import type { Metadata } from "next";
import { getPageBySlug, getStorefrontNavigation, listCollections, listShopProducts } from "@/lib/content/catalog";
import { getSiteVideos } from "@/lib/site-videos";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { HomePage } from "@/components/home/home-page";

export async function generateMetadata(): Promise<Metadata> {
  const [page, locale] = await Promise.all([getPageBySlug("home"), getRequestLocale()]);
  const content = page?.content ?? {};

  return {
    title: { absolute: page?.title || "Synarava — Curated Goods with Character" },
    description: page?.excerpt || undefined,
    alternates: buildAlternates(locale, "/"),
    openGraph: {
      url: localePath(locale, "/"),
      images: [
        content.heroImage
          ? { url: content.heroImage, width: 1200, height: 630, alt: page?.title || "Synarava" }
          : { url: "/og-default.jpg", width: 1200, height: 630, alt: "Synarava — Curated Goods with Character" },
      ],
    },
  };
}

export default async function Page() {
  const [page, collectionData, videos, products, locale, navigation] = await Promise.all([
    getPageBySlug("home"),
    listCollections(),
    getSiteVideos(),
    listShopProducts({}),
    getRequestLocale(),
    getStorefrontNavigation(),
  ]);

  const collections = collectionData
    .slice(0, 3)
    .map((c) => ({
      series: c.eyebrow,
      title: c.name,
      description: c.summary,
      price: "",
      image: c.heroImage,
      href: localePath(locale, `/collections/${c.slug}`),
    }));

  const content = (page?.content ?? {}) as Record<string, string>;
  const heroImage = content.heroImage || collections[0]?.image || "";
  const departments = navigation.map((department) => {
    const departmentProducts = products.filter((product) => product.departmentSlug === department.slug);
    return {
      slug: department.slug,
      name: department.name,
      count: departmentProducts.length,
      image: departmentProducts[0]?.image ?? "",
    };
  });

  return (
    <HomePage
      title={page?.title}
      excerpt={page?.excerpt}
      content={{ ...content, heroImage, heroTitle: page?.title ?? "", heroBody: content.body ?? page?.excerpt ?? "" }}
      collections={collections}
      departments={departments}
      heroVideoSrc={[videos.homeBeads, videos.homeModel, videos.braceletFilm, videos.materialsFilm]}
    />
  );
}
