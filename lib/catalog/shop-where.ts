import type { Prisma } from "@prisma/client";
import type { ShopFilters } from "@/lib/content/catalog";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Shared `Product.findMany` where-clause for every shop filter. Used by both
 * `listShopProducts` (collection/related-product queries) and the cursor
 * catalog page loader so filtering rules never drift between them.
 */
export function buildShopProductWhere(filters: ShopFilters, locale: Locale): Prisma.ProductWhereInput {
  const q = filters.q?.trim();
  const and: Prisma.ProductWhereInput[] = [];

  if (filters.collection) {
    and.push({ collections: { some: { collection: { slug: filters.collection } } } });
  }

  return {
    status: "ACTIVE",
    visibility: "PUBLIC",
    ...(and.length ? { AND: and } : {}),
    ...(filters.category ? { shopifyCategoryId: filters.category } : {}),
    ...(filters.productType ? { productType: filters.productType } : {}),
    ...(filters.availability === "in-stock"
      ? {
          variants: {
            some: {
              status: "ACTIVE",
              OR: [{ stockOnHand: { gt: 0 } }, { inventoryPolicy: "CONTINUE" }, { tracked: false }],
            },
          },
        }
      : {}),
    ...(filters.tag ? { tags: { some: { tag: { slug: filters.tag } } } } : {}),
    ...(filters.material ? { characteristics: { some: { key: "material", textValue: filters.material } } } : {}),
    ...(filters.finish ? { characteristics: { some: { key: "finish", textValue: filters.finish } } } : {}),
    ...(filters.origin ? { characteristics: { some: { key: "origin", textValue: filters.origin } } } : {}),
    ...(filters.certified ? { characteristics: { some: { key: filters.certified, booleanValue: true } } } : {}),
    ...(q
      ? {
          OR: [
            { sku: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { seriesLabel: { contains: q, mode: "insensitive" } },
            ...(locale === "en" ? [
              { name: { contains: q, mode: "insensitive" as const } },
              { shortDescription: { contains: q, mode: "insensitive" as const } },
              { materialLine: { contains: q, mode: "insensitive" as const } },
              { searchSummary: { contains: q, mode: "insensitive" as const } },
              { searchDocument: { contains: q, mode: "insensitive" as const } },
            ] : []),
            {
              translations: {
                some: {
                  locale,
                  OR: [
                    { title: { contains: q, mode: "insensitive" } },
                    { shortDescription: { contains: q, mode: "insensitive" } },
                    { description: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
}
