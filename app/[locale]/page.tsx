import type { Metadata } from "next";
import {
  getPageBySlug,
  listCollections,
  type PageContent,
} from "@/lib/content/catalog";
import { resolveHomeArchiveCollections } from "@/lib/content/home-archive-section";
import { listShopListingProducts } from "@/lib/content/shop-listing";
import { getSiteVideos } from "@/lib/site-videos";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { HomePage } from "@/components/home/home-page";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const page = await getPageBySlug("home", locale);
  const content = page?.content ?? {};

  return {
    title: { absolute: page?.title || "Synarava — Curated Goods with Character" },
    description: page?.excerpt || undefined,
    alternates: await buildAlternates(locale, "/"),
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
  const locale = await getRequestLocale();
  const [page, collectionData, videos, products] = await Promise.all([
    getPageBySlug("home", locale),
    listCollections(locale),
    getSiteVideos(),
    listShopListingProducts(locale),
  ]);

  const content: PageContent = page?.content ?? {};
  const collections = resolveHomeArchiveCollections(collectionData, content.archiveCollectionIds)
    .map((c) => ({
      series: c.eyebrow,
      title: c.name,
      description: c.summary,
      price: "",
      image: c.heroImage,
      href: localePath(locale, `/collections/${c.slug}`),
    }));

  return (
    <HomePage
      title={page?.title}
      excerpt={page?.excerpt}
      content={{ ...content, heroImage: content.heroImage, heroTitle: page?.title ?? "", heroBody: content.body ?? page?.excerpt ?? "" }}
      collections={collections}
      products={products.map((product) => ({
        id: product.id,
        slug: product.slug,
        title: product.title,
        sourceTitle: product.sourceTitle,
        price: product.price,
        image: product.image,
        series: product.series,
        categoryName: product.categoryName,
      }))}
      heroVideoSrc={[videos.homeBeads, videos.homeModel, videos.braceletFilm, videos.materialsFilm]}
    />
  );
}
