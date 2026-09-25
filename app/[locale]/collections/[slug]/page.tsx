import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getCollectionBySlug, getShopFilterData } from "@/lib/content/catalog";
import { listShopCatalogPage } from "@/lib/content/shop-listing";
import { normalizeShopSort } from "@/lib/catalog/shop-sort";
import { getRequestLocale, getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { buildAlternates } from "@/lib/seo/alternates";
import { safeJsonLd } from "@/lib/seo/json-ld";
import { CollectionDetail } from "@/components/collections/collection-detail";
import { shouldRedirectLocalizedHandle } from "@/lib/content/handle-localization";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    q?: string;
    availability?: string;
    category?: string;
    productType?: string;
    tag?: string;
    material?: string;
    finish?: string;
    origin?: string;
    certified?: string;
    sort?: string;
  }>;
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

export default async function Page({ params, searchParams }: Props) {
  const [{ slug }, locale, rawSearch] = await Promise.all([
    params,
    getRequestLocale(),
    searchParams ?? Promise.resolve({} as NonNullable<Awaited<NonNullable<Props["searchParams"]>>>),
  ]);
  const rawFilters = rawSearch;
  const [{ t }, collection] = await Promise.all([
    getServerTranslations(),
    getCollectionBySlug(slug, locale),
  ]);

  if (!collection) notFound();
  if (shouldRedirectLocalizedHandle(locale, slug, collection.slug)) {
    redirect(localePath(locale, `/collections/${collection.slug}`));
  }

  const filters = {
    q: rawFilters.q,
    category: rawFilters.category,
    productType: rawFilters.productType,
    tag: rawFilters.tag,
    material: rawFilters.material,
    finish: rawFilters.finish,
    origin: rawFilters.origin,
    certified: rawFilters.certified,
    availability: rawFilters.availability === "in-stock" ? "in-stock" as const : undefined,
    collection: collection.sourceSlug,
    sort: normalizeShopSort(rawFilters.sort),
  };

  const [filterData, firstPage] = await Promise.all([
    getShopFilterData(locale),
    listShopCatalogPage({ filters, locale, limit: 24 }),
  ]);
  const { categories, productTypes, tags, collections, materials, finishes, origins } = filterData;
  const collectionPath = `/collections/${collection.slug}`;

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
      <CollectionDetail
        collection={collection}
        catalog={{
          collectionName: collection.name,
          collectionPath,
          collectionSourceSlug: collection.sourceSlug,
          initialPage: firstPage,
          filterProps: {
            categories: categories.map((c) => ({ value: c.slug, label: c.name })),
            productTypes: productTypes.map((type) => ({ value: type.slug, label: type.name })),
            collections: collections.map((c) => ({ value: c.slug, label: c.name })),
            tags: tags.map((tag) => ({ value: tag.slug, label: tag.name })),
            materials: materials.map((item) => ({ value: item.slug, label: item.name })),
            finishes: finishes.map((item) => ({ value: item.slug, label: item.name })),
            origins: origins.map((item) => ({ value: item.slug, label: item.name })),
            initialFilters: filters,
          },
        }}
      />
    </>
  );
}
