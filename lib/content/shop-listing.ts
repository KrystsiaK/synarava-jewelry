import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { featuredCollectionPosition } from "@/lib/catalog/collection-order";
import { isVariantPurchasable } from "@/lib/commerce/variant-availability";
import { storefrontMedia } from "@/lib/content/media-fallbacks";
import { formatCurrency } from "@/lib/i18n/format";
import { resolveLocalizedContent } from "@/lib/i18n/localized-content";
import { getRequestLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locales";
import { resolveCollectionName } from "@/lib/collections/localization";
import { resolveLocalizedHandle } from "@/lib/content/handle-localization";
import { buildShopProductWhere } from "@/lib/catalog/shop-where";
import {
  CATALOG_CANDIDATE_CAP,
  CATALOG_DEFAULT_PAGE_SIZE,
  CATALOG_MAX_PAGE_SIZE,
  decodeCatalogCursor,
  encodeCatalogCursor,
} from "@/lib/catalog/shop-query";
import { normalizeShopSort, type ShopSort } from "@/lib/catalog/shop-sort";
import { listBestSellingShopifyProductIds, type ShopFilters } from "@/lib/content/catalog";

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

const SHOP_LISTING_SELECT = {
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
    select: { locale: true, localizedHandle: true, title: true, shortDescription: true, description: true, materialLine: true },
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
} satisfies Prisma.ProductSelect;

type ShopListingRow = Prisma.ProductGetPayload<{ select: typeof SHOP_LISTING_SELECT }>;

function mapProductRowToListing(row: ShopListingRow, locale: Locale): ShopListingProduct {
  const translation = locale !== "en" ? row.translations.find((item) => item.locale === locale) : null;
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
}

export async function listShopListingProducts(requestedLocale?: Locale): Promise<ShopListingProduct[]> {
  const locale = requestedLocale ?? await getRequestLocale();
  const rows = await db.product.findMany({
    where: { status: "ACTIVE", visibility: "PUBLIC" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: SHOP_LISTING_SELECT,
  });

  return rows
    .sort((left, right) => featuredCollectionPosition(left.collections, undefined) - featuredCollectionPosition(right.collections, undefined))
    .map((row) => mapProductRowToListing(row, locale));
}

async function getBestSellingRankMap(): Promise<Map<string, number> | null> {
  const ids = await listBestSellingShopifyProductIds();
  return ids ? new Map(ids.map((id, index) => [id, index])) : null;
}

function buildCatalogComparator(
  sort: ShopSort,
  locale: Locale,
  collectionSlug: string | undefined,
  rawById: Map<string, ShopListingRow> | null,
  popularRank: Map<string, number> | null,
) {
  return (left: ShopListingProduct, right: ShopListingProduct) => {
    let primary = 0;
    if (sort === "featured" && rawById) {
      primary = featuredCollectionPosition(rawById.get(left.id)!.collections, collectionSlug)
        - featuredCollectionPosition(rawById.get(right.id)!.collections, collectionSlug);
    } else if (sort === "popular") {
      primary = popularRank
        ? (popularRank.get(left.shopifyProductId ?? "") ?? Number.POSITIVE_INFINITY)
          - (popularRank.get(right.shopifyProductId ?? "") ?? Number.POSITIVE_INFINITY)
        : right.createdAt.getTime() - left.createdAt.getTime();
    } else if (sort === "newest") {
      primary = right.createdAt.getTime() - left.createdAt.getTime();
    } else if (sort === "price-asc") {
      primary = left.priceAmount - right.priceAmount;
    } else if (sort === "price-desc") {
      primary = right.priceAmount - left.priceAmount;
    } else if (sort === "name-asc") {
      primary = left.title.localeCompare(right.title, locale);
    }
    // Stable tie-breaker so the cursor (keyed on product id) always lands on
    // a well-defined position, even when the primary sort key ties.
    return primary !== 0 ? primary : left.id.localeCompare(right.id);
  };
}

export type ShopCatalogPage = {
  nodes: ShopListingProduct[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
  /** false once `sort: "popular"` had to fall back because Shopify's ranking wasn't reachable/configured. */
  popularAvailable: boolean;
};

/**
 * Server-side filtered, sorted, cursor-paginated catalog page. Filters run
 * as a DB `where` (shared with `listShopProducts` via `buildShopProductWhere`
 * so the two never disagree on what counts as a match); sorting resorts the
 * matched rows in memory because listing price and popularity rank aren't
 * plain columns (see CATALOG_CANDIDATE_CAP for the scale this assumes).
 */
export async function listShopCatalogPage(params: {
  filters: ShopFilters;
  locale: Locale;
  cursor?: string | null;
  limit?: number;
}): Promise<ShopCatalogPage> {
  const { locale } = params;
  const sort = normalizeShopSort(params.filters.sort);
  const filters: ShopFilters = { ...params.filters, sort };
  const limit = params.limit ? Math.min(Math.max(1, Math.trunc(params.limit)), CATALOG_MAX_PAGE_SIZE) : CATALOG_DEFAULT_PAGE_SIZE;

  const rows = await db.product.findMany({
    where: buildShopProductWhere(filters, locale),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: CATALOG_CANDIDATE_CAP,
    select: SHOP_LISTING_SELECT,
  });

  const popularRank = sort === "popular" ? await getBestSellingRankMap() : null;
  const rawById = sort === "featured" ? new Map(rows.map((row) => [row.id, row])) : null;

  const nodes = rows.map((row) => mapProductRowToListing(row, locale));
  nodes.sort(buildCatalogComparator(sort, locale, filters.collection, rawById, popularRank));

  const cursorId = decodeCatalogCursor(params.cursor, filters, locale);
  const afterIndex = cursorId ? nodes.findIndex((node) => node.id === cursorId) : -1;
  const startIndex = afterIndex + 1; // -1 (no/stale cursor) restarts from the top.

  const window = nodes.slice(startIndex, startIndex + limit + 1);
  const hasNextPage = window.length > limit;
  const page = window.slice(0, limit);
  const endCursor = hasNextPage ? encodeCatalogCursor(filters, locale, page[page.length - 1].id) : null;

  return {
    nodes: page,
    hasNextPage,
    endCursor,
    totalCount: nodes.length,
    popularAvailable: sort !== "popular" || popularRank !== null,
  };
}
