import { db } from "@/lib/db";
import { featuredCollectionPosition } from "@/lib/catalog/collection-order";
import { isVariantPurchasable } from "@/lib/commerce/variant-availability";
import { storefrontMedia } from "@/lib/content/media-fallbacks";
import { formatCurrency } from "@/lib/i18n/format";
import { resolveLocalizedContent, storefrontLocaleToContentLocale } from "@/lib/i18n/localized-content";
import { getRequestLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locales";
import { resolveCollectionName } from "@/lib/collections/localization";
import { resolveLocalizedHandle } from "@/lib/content/handle-localization";

/** Fields used by shop cards, discovery, sorting and client-side filters. */
export type ShopListingProduct = {
  id: string;
  shopifyProductId: string | null;
  slug: string;
  sourceTitle: string;
  series: string;
  title: string;
  shortDescription: string;
  price: string;
  priceAmount: number;
  compareAtPrice: string;
  compareAtAmount: number | null;
  image: string;
  inStock: boolean;
  searchText: string;
  departmentSlug: string | null;
  departmentName: string;
  categorySlug: string | null;
  categoryName: string;
  productType: string;
  collectionSlugs: string[];
  tagSlugs: string[];
  tagNames: string[];
  characteristics: Array<{ key: string; textValue: string | null; booleanValue: boolean | null }>;
  createdAt: Date;
};

function categoryLeafLabel(fullName: string | null) {
  return fullName?.split(">").at(-1)?.trim() ?? "";
}

export async function listShopListingProducts(requestedLocale?: Locale): Promise<ShopListingProduct[]> {
  const locale = requestedLocale ?? await getRequestLocale();
  const rows = await db.product.findMany({
    where: { status: "ACTIVE", visibility: "PUBLIC" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      sku: true,
      shopifyProductId: true,
      name: true,
      productType: true,
      seriesLabel: true,
      shortDescription: true,
      description: true,
      materialLine: true,
      searchSummary: true,
      searchDocument: true,
      currency: true,
      priceCents: true,
      imageUrl: true,
      shopifyCategoryId: true,
      shopifyCategoryName: true,
      createdAt: true,
      translations: {
        where: { locale: storefrontLocaleToContentLocale(locale) },
        select: { localizedHandle: true, title: true, shortDescription: true, description: true, materialLine: true },
      },
      variants: {
        orderBy: { createdAt: "asc" },
        select: {
          status: true,
          stockOnHand: true,
          inventoryPolicy: true,
          tracked: true,
          priceCents: true,
          compareAtCents: true,
        },
      },
      tags: { select: { tag: { select: { slug: true, name: true } } } },
      collections: {
        select: {
          sortOrder: true,
          collection: {
            select: {
              slug: true,
              name: true,
              isPrimaryNav: true,
              isStorefrontDefault: true,
              translations: { select: { locale: true, name: true } },
            },
          },
        },
      },
      characteristics: {
        select: { key: true, textValue: true, booleanValue: true },
      },
    },
  });

  return rows
    .sort((left, right) => featuredCollectionPosition(left.collections) - featuredCollectionPosition(right.collections))
    .map((row) => {
      const translation = locale === "pt" ? row.translations[0] : null;
      const copy = resolveLocalizedContent({
        source: {
          title: row.name,
          shortDescription: row.shortDescription ?? "",
          description: row.description ?? "",
          materialLine: row.materialLine ?? "",
        },
        translation: translation ? {
          title: translation.title,
          shortDescription: translation.shortDescription ?? "",
          description: translation.description ?? "",
          materialLine: translation.materialLine ?? "",
        } : null,
        optionalFields: ["materialLine"],
      });
      const primaryVariant = row.variants.find(isVariantPurchasable) ?? row.variants[0];
      const priceCents = primaryVariant?.priceCents ?? row.priceCents;
      const compareAtCents = primaryVariant?.compareAtCents ?? null;
      const department = row.collections.find((item) => item.collection.isPrimaryNav)?.collection;
      const departmentName = department ? resolveCollectionName(department, locale) : "";
      return {
        id: row.id,
        shopifyProductId: row.shopifyProductId,
        slug: resolveLocalizedHandle(locale, row.slug, translation?.localizedHandle),
        sourceTitle: row.name,
        series: row.seriesLabel ?? "",
        title: copy.title,
        shortDescription: copy.shortDescription,
        price: formatCurrency(priceCents / 100, row.currency, locale),
        priceAmount: priceCents / 100,
        compareAtPrice: compareAtCents == null ? "" : formatCurrency(compareAtCents / 100, row.currency, locale),
        compareAtAmount: compareAtCents == null ? null : compareAtCents / 100,
        image: storefrontMedia(row.imageUrl, row.slug),
        inStock: row.variants.some(isVariantPurchasable),
        searchText: [
          row.slug, row.sku, row.seriesLabel, row.searchSummary, row.searchDocument,
          copy.title, copy.shortDescription, copy.description, copy.materialLine,
          row.shopifyCategoryName, departmentName,
          ...row.tags.flatMap((item) => [item.tag.slug, item.tag.name]),
        ].filter(Boolean).join(" "),
        departmentSlug: department?.slug ?? null,
        departmentName,
        categorySlug: row.shopifyCategoryId,
        categoryName: categoryLeafLabel(row.shopifyCategoryName),
        productType: row.productType?.trim() ?? "",
        collectionSlugs: row.collections.map((item) => item.collection.slug),
        tagSlugs: row.tags.map((item) => item.tag.slug),
        tagNames: row.tags.map((item) => item.tag.name),
        characteristics: row.characteristics,
        createdAt: row.createdAt,
      };
    });
}
