import type { Metadata } from "next";

import { getPageBySlug, listCollections } from "@/lib/content/catalog";
import { resolveCollectionsIndexCollections } from "@/lib/content/collections-index-section";
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
  const [collectionData, page] = await Promise.all([
    listCollections(locale),
    getPageBySlug("collections", locale),
  ]);
  const content = page?.content;
  const collections = resolveCollectionsIndexCollections(
    collectionData,
    content?.archiveCollectionIds,
  );
  return (
    <CollectionsPage
      collections={collections}
      heroImage={content?.heroImage}
      content={{
        eyebrow: content?.eyebrow,
        heading: content?.secondaryTitle,
        introduction: content?.body,
        calloutEyebrow: content?.calloutEyebrow,
        calloutHeading: content?.calloutHeading,
        calloutCtaLabel: content?.ctaLabel,
        calloutCtaHref: content?.calloutCtaHref,
        cardCtaLabel: content?.secondaryBody,
      }}
    />
  );
}
