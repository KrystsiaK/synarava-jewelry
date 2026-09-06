import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCollectionBySlug, getProductsByCollection } from "@/lib/content/catalog";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { safeJsonLd } from "@/lib/seo/json-ld";
import { CollectionDetail } from "@/components/collections/collection-detail";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    return { title: "Collection" };
  }

  return {
    title: collection.name,
    description: collection.summary,
    alternates: buildAlternates(locale, `/collections/${slug}`),
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
  const [collection, products] = await Promise.all([
    getCollectionBySlug(slug),
    getProductsByCollection(slug),
  ]);

  if (!collection) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: new URL(localePath(locale, "/"), siteUrl).toString() },
      { "@type": "ListItem", position: 2, name: "Collections", item: new URL(localePath(locale, "/collections"), siteUrl).toString() },
      { "@type": "ListItem", position: 3, name: collection.name, item: new URL(localePath(locale, `/collections/${slug}`), siteUrl).toString() },
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