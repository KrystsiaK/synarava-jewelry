import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getCollectionBySlug, getProductsByCollection } from "@/lib/content/catalog";
import { getRequestLocale, getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { buildAlternates } from "@/lib/seo/alternates";
import { safeJsonLd } from "@/lib/seo/json-ld";
import { CollectionDetail } from "@/components/collections/collection-detail";
import { shouldRedirectLocalizedHandle } from "@/lib/content/handle-localization";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const collection = await getCollectionBySlug(slug, locale);

  if (!collection) {
    return { title: "Collection" };
  }

  return {
    title: collection.name,
    description: collection.summary,
    alternates: await buildAlternates(locale, `/collections/${collection.slug}`, {
      en: `/collections/${collection.sourceSlug}`,
      pt: `/collections/${collection.slug}`,
    }),
    openGraph: {
      url: localePath(locale, `/collections/${slug}`),
      images: [
        {
          url: collection.heroImage,
          width: 1200,
          height: 630,
          alt: collection.name,
        },
      ],
    },
  };
}

export default async function Page({ params }: Props) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const [{ t }, collection] = await Promise.all([
    getServerTranslations(),
    getCollectionBySlug(slug, locale),
  ]);

  if (!collection) notFound();
  if (shouldRedirectLocalizedHandle(locale, slug, collection.slug)) redirect(localePath(locale, `/collections/${collection.slug}`));
  const products = await getProductsByCollection(collection.sourceSlug, locale);

  const siteUrl = getPublicSiteUrl();
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("nav.home"), item: new URL(localePath(locale, "/"), siteUrl).toString() },
      { "@type": "ListItem", position: 2, name: t("nav.collections"), item: new URL(localePath(locale, "/collections"), siteUrl).toString() },
      { "@type": "ListItem", position: 3, name: collection.name, item: new URL(localePath(locale, `/collections/${collection.slug}`), siteUrl).toString() },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <CollectionDetail collection={collection} products={products} />
    </>
  );
}
