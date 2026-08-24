import type { Metadata } from "next";

import { getShopFilterData, listShopProducts } from "@/lib/content/catalog";
import { ShopPage } from "@/components/shop/shop-page";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Browse Synarava jewelry, pet accessories, creative kits for kids, and jewelry-making supplies.",
  alternates: { canonical: "/shop" },
  openGraph: { url: "/shop" },
};

type Props = {
  searchParams?: Promise<{
    q?: string;
    department?: string;
    category?: string;
    tag?: string;
    collection?: string;
    material?: string;
    finish?: string;
    origin?: string;
    certified?: string;
  }>;
};

export default async function Page({ searchParams }: Props) {
  const filters = (await searchParams) ?? {};
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
