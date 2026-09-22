import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getPageBySlug, getShopFilterData } from "@/lib/content/catalog";
import { listShopCatalogPage } from "@/lib/content/shop-listing";
import { storefrontMedia } from "@/lib/content/media-fallbacks";
import { ShopPage } from "@/components/shop/shop-page";
import type { ShopProductTypeTile } from "@/components/shop/shop-discovery";
import { normalizeShopSort } from "@/lib/catalog/shop-sort";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getServerTranslations();
  const page = await getPageBySlug("shop", locale);
  const heroImage = page?.content.heroImage;
  const { title, description } = localizedPageMetadataCopy({
    page,
    fallbackTitle: t("nav.shop"),
    fallbackDescription: t("shop.heroDescription"),
  });
  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/shop"),
    openGraph: {
      url: localePath(locale, "/shop"),
      images: [{ url: heroImage || "/og-default.jpg", width: 1200, height: 630, alt: `Synarava — ${title}` }],
    },
  };
}

type Props = {
  searchParams?: Promise<{
    q?: string;
    department?: string;
    availability?: string;
    category?: string;
    productType?: string;
    tag?: string;
    collection?: string;
    material?: string;
    finish?: string;
    origin?: string;
    certified?: string;
    sort?: string;
  }>;
};

/** Cover image + count per product type, from one lean scan (no variants/translations/relations). */
async function getProductTypeTiles(productTypes: { slug: string; name: string }[]): Promise<ShopProductTypeTile[]> {
  if (productTypes.length === 0) return [];
  const rows = await db.product.findMany({
    where: { status: "ACTIVE", visibility: "PUBLIC", productType: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { productType: true, imageUrl: true, slug: true },
  });
  const byType = new Map<string, { image: string; count: number }>();
  for (const row of rows) {
    const type = row.productType?.trim();
    if (!type) continue;
    const existing = byType.get(type);
    byType.set(type, {
      image: existing?.image ?? storefrontMedia(row.imageUrl, row.slug),
      count: (existing?.count ?? 0) + 1,
    });
  }
  return productTypes.flatMap((type) => {
    const entry = byType.get(type.slug);
    return entry ? [{ slug: type.slug, name: type.name, image: entry.image, count: entry.count }] : [];
  });
}

async function getDepartmentSlugsInUse(): Promise<Set<string>> {
  const rows = await db.productCollection.findMany({
    where: { collection: { isPrimaryNav: true }, product: { status: "ACTIVE", visibility: "PUBLIC" } },
    select: { collection: { select: { slug: true } } },
    distinct: ["collectionId"],
  });
  return new Set(rows.map((row) => row.collection.slug));
}

export default async function Page({ searchParams }: Props) {
  const rawFilters = (await searchParams) ?? {};
  const filters = {
    ...rawFilters,
    availability: rawFilters.availability === "in-stock" ? "in-stock" as const : undefined,
    sort: normalizeShopSort(rawFilters.sort),
  };
  const { t, locale } = await getServerTranslations();
  const [
    filterData,
    firstPage,
    newest,
    popular,
    archiveCount,
    departmentSlugsInUse,
    page,
  ] = await Promise.all([
    getShopFilterData(locale),
    listShopCatalogPage({ filters, locale, limit: 24 }),
    listShopCatalogPage({ filters: { sort: "newest" }, locale, limit: 8 }),
    listShopCatalogPage({ filters: { sort: "popular" }, locale, limit: 8 }),
    db.product.count({ where: { status: "ACTIVE", visibility: "PUBLIC" } }),
    getDepartmentSlugsInUse(),
    getPageBySlug("shop", locale),
  ]);
  const { departments, categories, productTypes, tags, collections, materials, finishes, origins } = filterData;
  const productTypeTiles = await getProductTypeTiles(productTypes);

  return (
    <ShopPage
      initialPage={firstPage}
      newestProducts={newest.nodes}
      popularProducts={popular.nodes}
      showPopular={popular.popularAvailable && popular.nodes.length > 0}
      heroImage={page?.content.heroImage}
      heroTitle={page?.title || t("nav.shop")}
      heroDescription={page?.content.body || t("shop.heroDescription")}
      archiveCount={archiveCount}
      productTypeTiles={productTypeTiles}
      collectionsCalloutEyebrow={page?.content.eyebrow}
      collectionsCalloutTitle={page?.content.secondaryTitle}
      collectionsCalloutCtaLabel={page?.content.ctaLabel}
      collectionsCalloutSecondaryLabel={page?.content.secondaryBody}
      filterProps={{
        departments: departments.map((department) => ({
          value: department.slug,
          label: department.name,
          hint: departmentSlugsInUse.has(department.slug) ? undefined : t("shop.filters.comingSoon"),
        })),
        categories: categories.map((c) => ({ value: c.slug, label: c.name })),
        productTypes: productTypes.map((type) => ({ value: type.slug, label: type.name })),
        collections: collections.map((c) => ({ value: c.slug, label: c.name })),
        tags: tags.map((t) => ({ value: t.slug, label: t.name })),
        materials: materials.map((item) => ({ value: item.slug, label: item.name })),
        finishes: finishes.map((item) => ({ value: item.slug, label: item.name })),
        origins: origins.map((item) => ({ value: item.slug, label: item.name })),
        initialFilters: filters,
      }}
    />
  );
}
