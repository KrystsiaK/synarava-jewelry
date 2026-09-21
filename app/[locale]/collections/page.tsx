import type { Metadata } from "next";

import { getPageBySlug, listCollections } from "@/lib/content/catalog";
import { CollectionsPage } from "@/components/collections/collections-page";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getServerTranslations();
  const page = await getPageBySlug("collections", locale);
  const heroImage = page?.content.heroImage;
  const { title, description } = localizedPageMetadataCopy({
    page,
    fallbackTitle: t("nav.collections"),
    fallbackDescription: t("shop.discovery.categoryDescription"),
  });
  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/collections"),
    openGraph: {
      url: localePath(locale, "/collections"),
      images: [{ url: heroImage || "/og-default.jpg", width: 1200, height: 630, alt: `Synarava — ${title}` }],
    },
  };
}

export default async function Page() {
  const { locale } = await getServerTranslations();
  const [collections, page] = await Promise.all([
    listCollections(locale),
    getPageBySlug("collections", locale),
  ]);
  return <CollectionsPage collections={collections} heroImage={page?.content.heroImage} />;
}
