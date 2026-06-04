import type { Metadata } from "next";

import { getShopFilterData, listShopProducts } from "@/lib/content/catalog";
import { ShopPage } from "@/components/shop/shop-page";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Browse all Synarava handcrafted jewelry. Bracelets, symbolic editions, and earth pieces made from lava stone, oak wood, and white ceramic.",
  alternates: { canonical: "/shop" },
  openGraph: { url: "/shop" },
};

type Props = {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    tag?: string;
    collection?: string;
  }>;
};

export default async function Page({ searchParams }: Props) {
  const filters = (await searchParams) ?? {};
  const { categories, tags, collections } = await getShopFilterData();
  const products = await listShopProducts(filters);

  return (
    <ShopPage
      products={products}
      filterProps={{
        categories: categories.map((c) => ({ value: c.slug, label: c.name })),
        collections: collections.map((c) => ({ value: c.slug, label: c.name })),
        tags: tags.map((t) => ({ value: t.slug, label: t.name })),
        initialFilters: filters,
      }}
    />
  );
}