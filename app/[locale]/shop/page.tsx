import type { Metadata } from "next";

import { getShopFilterData, listShopProducts } from "@/lib/content/catalog";
import { ShopPage } from "@/components/shop/shop-page";
import { normalizeShopSort } from "@/lib/catalog/shop-sort";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: "Shop",
    description:
      "Browse Synarava jewelry, pet accessories, creative kits for kids, and jewelry-making supplies.",
    alternates: buildAlternates(locale, "/shop"),
    openGraph: {
      url: localePath(locale, "/shop"),
      images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: "Synarava — Shop" }],
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
  const [{ departments, categories, tags, collections, materials, finishes, origins }, products, archiveProducts] = await Promise.all([
    getShopFilterData(),
    listShopProducts(filters),
    listShopProducts({}),
  ]);

  return (
    <ShopPage
      products={products}
      leadProduct={archiveProducts[0]}
      archiveCount={archiveProducts.length}
      filterProps={{
        departments: departments.map((department) => ({
          value: department.slug,
          label: department.name,
        })),
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
