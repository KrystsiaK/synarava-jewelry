import type { Metadata } from "next";

import { getPageBySlug, getShopFilterData, listBestSellingShopifyProductIds } from "@/lib/content/catalog";
import { listShopListingProducts } from "@/lib/content/shop-listing";
import { ShopPage } from "@/components/shop/shop-page";
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
    alternates: buildAlternates(locale, "/shop"),
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

export default async function Page({ searchParams }: Props) {
  const rawFilters = (await searchParams) ?? {};
  const filters = {
    ...rawFilters,
    availability: rawFilters.availability === "in-stock" ? "in-stock" as const : undefined,
    sort: normalizeShopSort(rawFilters.sort),
  };
  const { t, locale } = await getServerTranslations();
  const [{ departments, categories, productTypes, tags, collections, materials, finishes, origins }, archiveProducts, bestSellingShopifyProductIds, page] = await Promise.all([
    getShopFilterData(locale),
    listShopListingProducts(locale),
    listBestSellingShopifyProductIds(),
    getPageBySlug("shop", locale),
  ]);

  const productTypeTiles = productTypes.flatMap((productType) => {
    const typeProducts = archiveProducts.filter((product) => product.productType === productType.slug);
    const image = typeProducts[0]?.image;
    return image ? [{ ...productType, image, count: typeProducts.length }] : [];
  });
  const productsByShopifyId = new Map(
    archiveProducts.flatMap((product) => (
      product.shopifyProductId ? [[product.shopifyProductId, product.slug] as const] : []
    )),
  );
  const popularProductSlugs = bestSellingShopifyProductIds?.flatMap((id) => {
    const slug = productsByShopifyId.get(id);
    return slug ? [slug] : [];
  }) ?? null;

  return (
    <ShopPage
      products={archiveProducts}
      popularProductSlugs={popularProductSlugs}
      heroImage={page?.content.heroImage}
      heroTitle={page?.title || t("nav.shop")}
      heroDescription={page?.content.body || t("shop.heroDescription")}
      archiveCount={archiveProducts.length}
      productTypeTiles={productTypeTiles}
      filterProps={{
        departments: departments.map((department) => {
          const hasProducts = archiveProducts.some((product) => product.departmentSlug === department.slug);
          return {
            value: department.slug,
            label: department.name,
            hint: hasProducts ? undefined : t("shop.filters.comingSoon"),
          };
        }),
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
