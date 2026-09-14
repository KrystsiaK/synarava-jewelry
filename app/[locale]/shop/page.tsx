import type { Metadata } from "next";

import { getPageBySlug, getShopFilterData, listBestSellingShopifyProductIds, listShopProducts } from "@/lib/content/catalog";
import { ShopPage } from "@/components/shop/shop-page";
import { normalizeShopSort } from "@/lib/catalog/shop-sort";
import { getRequestLocale, getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { storefrontMedia } from "@/lib/content/media-fallbacks";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, page] = await Promise.all([getRequestLocale(), getPageBySlug("shop")]);
  const heroImage = page?.content.heroImage;
  return {
    title: "Shop",
    description:
      "Browse Synarava jewelry, pet accessories, creative kits for kids, and jewelry-making supplies.",
    alternates: buildAlternates(locale, "/shop"),
    openGraph: {
      url: localePath(locale, "/shop"),
      images: [{ url: heroImage || "/og-default.jpg", width: 1200, height: 630, alt: "Synarava — Shop" }],
    },
  };
}

type Props = {
  searchParams?: Promise<{
    q?: string;
    department?: string;
    availability?: string;
    category?: string;
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
  const [{ departments, categories, tags, collections, materials, finishes, origins }, archiveProducts, bestSellingShopifyProductIds, { t }, page] = await Promise.all([
    getShopFilterData(),
    listShopProducts({}),
    listBestSellingShopifyProductIds(),
    getServerTranslations(),
    getPageBySlug("shop"),
  ]);

  const departmentTiles = departments.map((department) => {
    const departmentProducts = archiveProducts.filter((product) => product.departmentSlug === department.slug);
    return {
      slug: department.slug,
      name: department.name,
      count: departmentProducts.length,
      image: departmentProducts[0]?.image ?? "",
    };
  });
  const collectionTiles = collections.slice(0, 6).map((collection) => ({
    slug: collection.slug,
    name: collection.name,
    image: storefrontMedia(collection.heroImageUrl, collection.slug),
  }));
  const categoryTiles = categories.flatMap((category) => {
    const categoryProducts = archiveProducts.filter((product) => product.categorySlug === category.slug);
    const image = categoryProducts[0]?.image;
    return image ? [{ ...category, image, count: categoryProducts.length }] : [];
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
      archiveCount={archiveProducts.length}
      departmentTiles={departmentTiles}
      collectionTiles={collectionTiles}
      categoryTiles={categoryTiles}
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
