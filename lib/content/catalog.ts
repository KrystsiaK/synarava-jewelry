import { db } from "@/lib/db";
import type { ShopDepartmentSlug } from "@/lib/catalog/taxonomy";
import {
  parseProductDetails,
  type ProductAttribute,
  type ProductLookbookStory,
  type ProductMaterialStory,
  type ProductProcessStory,
} from "@/lib/content/product-details";
import { characteristicDisplayValue, characteristicLabel, type ProductCharacteristicValue } from "@/lib/products/characteristics";
import { projectPublicProductMetafields } from "@/lib/shopify/public-metafields";
import { storefrontMedia } from "@/lib/content/media-fallbacks";
import { normalizeShopSort, type ShopSort } from "@/lib/catalog/shop-sort";
import { featuredCollectionPosition } from "@/lib/catalog/collection-order";
import { getCachedShopifyCollectionBestSelling } from "@/lib/shopify/collection-order";
import { formatCurrency } from "@/lib/i18n/format";
import { getRequestLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locales";
import { getS3PublicUrl } from "@/lib/s3";
import { combineProductGallery } from "@/lib/media/product-gallery";
import { isSynaravaProductAccessible } from "@/lib/shopify/reconciliation";
import { isVariantPurchasable } from "@/lib/commerce/variant-availability";
import {
  resolveProductCopy,
  type ProductTranslationRecord,
} from "@/lib/products/localization";
import { resolveCollectionCopy, resolveCollectionName } from "@/lib/collections/localization";
import { resolvePageLocalizedCopy } from "@/lib/pages/localization";
import { resolveLocalizedHandle } from "@/lib/content/handle-localization";
import { findLocalizedHandleRedirect } from "@/lib/content/handle-redirects";

// Shopify's Standard Product Taxonomy name is a " > "-delimited full path
// (e.g. "Apparel & Accessories > Jewelry > Brooches & Lapel Pins >
// Brooches"). `shopifyCategoryName` keeps that full path for structured
// data; customer-facing labels (card tags, breadcrumbs, spec rows) want
// just the leaf.
function categoryLeafLabel(fullName: string | null | undefined) {
  if (!fullName) return fullName ?? "";
  const segments = fullName.split(">").map((segment) => segment.trim()).filter(Boolean);
  return segments[segments.length - 1] ?? fullName;
}

export type CollectionSummary = {
  slug: string;
  sourceSlug: string;
  name: string;
  eyebrow: string;
  summary: string;
  heroImage: string;
  accent: string;
  updatedAt: Date;
};

export type ProductSummary = {
  shopifyProductId: string | null;
  slug: string;
  sourceSlug: string;
  sku: string;
  series: string;
  title: string;
  shortDescription: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  price: string;
  priceAmount: number;
  currency: string;
  compareAtPrice: string;
  compareAtAmount: number | null;
  stockOnHand: number;
  inStock: boolean;
  searchText: string;
  variantCount: number;
  vendor: string;
  productType: string;
  shopifyCategoryName: string;
  commerceMedia: Array<{ src: string; alt: string; width: number | null; height: number | null }>;
  options: Array<{ name: string; values: string[] }>;
  variantDetails: Array<{
    merchandiseId: string | null;
    title: string;
    sku: string;
    barcode: string;
    price: string;
    priceAmount: number;
    compareAtPrice: string;
    compareAtAmount: number | null;
    stockOnHand: number;
    available: boolean;
    weightGrams: number | null;
    selectedOptions: Array<{ name: string; value: string }>;
  }>;
  image: string;
  collectionSlug: string;
  collectionSlugs: string[];
  collectionName: string;
  materialLine: string;
  departmentSlug: ShopDepartmentSlug | null;
  departmentName: string;
  attributes: ProductAttribute[];
  characteristics: ProductCharacteristicValue[];
  categorySlug: string | null;
  categoryName: string | null;
  tagSlugs: string[];
  tagNames: string[];
  publicMetafields: Array<{ label: string; value: string }>;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  materialsEyebrow: string;
  materialsTitle: string;
  materials: ProductMaterialStory[];
  process: ProductProcessStory;
  lookbookEyebrow: string;
  lookbookTitle: string;
  lookbook: ProductLookbookStory[];
  updatedAt: Date;
  createdAt: Date;
};

export type ShopFilters = {
  q?: string;
  department?: string;
  availability?: "in-stock" | string;
  category?: string;
  productType?: string;
  tag?: string;
  collection?: string;
  material?: string;
  finish?: string;
  origin?: string;
  certified?: string;
  sort?: ShopSort | string;
};

export type PageContent = {
  eyebrow?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  quote?: string;
  secondaryTitle?: string;
  secondaryBody?: string;
  heroImage?: string;
  heroSectionEnabled?: boolean;
  departmentSectionEnabled?: boolean;
  archiveSectionEnabled?: boolean;
  editSectionEnabled?: boolean;
  materialSectionEnabled?: boolean;
  manifestoSectionEnabled?: boolean;
  finalCtaSectionEnabled?: boolean;
  departmentSectionTitle?: string;
  departmentSectionBody?: string;
  departmentSectionImageCaption?: string;
  departmentSectionCtaLabel?: string;
  archiveSectionLabel?: string;
  editSectionEyebrow?: string;
  editSectionTitle?: string;
  editSectionBody?: string;
  editSectionCtaLabel?: string;
  editProductIds?: string[];
  materialSectionEyebrow?: string;
  materialSectionTitle?: string;
  materialSectionNoteLabel?: string;
  materialLexicon?: Array<{
    name?: string;
    category?: string;
    description?: string;
    image?: string;
    properties?: string;
  }>;
  manifestoSectionLabel?: string;
  manifestoSectionAttribution?: string;
  finalCtaLabel?: string;
  finalCtaHref?: string;
  finalFooterTitle?: string;
  finalContactLabel?: string;
  finalContactEmail?: string;
  legalIntro?: string;
  legalLastUpdated?: string;
  legalSections?: Record<string, { title?: string; body?: string }>;
  serviceSections?: Record<string, { title?: string; body?: string }>;
  translations?: {
    pt?: Omit<PageContent,
      | "translations"
      | "heroImage"
      | "heroSectionEnabled"
      | "departmentSectionEnabled"
      | "archiveSectionEnabled"
      | "editSectionEnabled"
      | "editProductIds"
      | "materialSectionEnabled"
      | "manifestoSectionEnabled"
      | "finalCtaSectionEnabled"
    > & {
      title?: string;
      excerpt?: string;
    };
  };
};

function priceFromCents(priceCents: number, currency: string, locale: Locale) {
  return formatCurrency(priceCents / 100, currency, locale);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function shopifyProjection(value: unknown) {
  const snapshot = asRecord(value);
  const media = Array.isArray(snapshot.media) ? snapshot.media : [];
  const options = Array.isArray(snapshot.options) ? snapshot.options : [];
  return {
    media: media.flatMap((item) => {
      const row = asRecord(item);
      const preview = asRecord(row.preview);
      const image = asRecord(preview.image);
      const src = typeof image.url === "string" ? image.url : "";
      if (!src) return [];
      return [{
        src,
        alt: typeof row.alt === "string" ? row.alt : "",
        width: typeof image.width === "number" ? image.width : null,
        height: typeof image.height === "number" ? image.height : null,
      }];
    }),
    options: options.flatMap((item) => {
      const row = asRecord(item);
      if (typeof row.name !== "string") return [];
      return [{
        name: row.name,
        values: Array.isArray(row.values) ? row.values.filter((value): value is string => typeof value === "string") : [],
      }];
    }),
    publicMetafields: projectPublicProductMetafields(snapshot.metafields),
  };
}

function toSummary(product: {
  shopifyProductId: string | null;
  slug: string;
  sku: string;
  name: string;
  seriesLabel: string | null;
  shortDescription: string | null;
  description: string | null;
  searchSummary: string | null;
  searchDocument: string | null;
  priceCents: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  vendor: string | null;
  productType: string | null;
  shopifyCategoryId: string | null;
  shopifyCategoryName: string | null;
  shopifySnapshot: unknown;
  imageUrl: string | null;
  materialLine: string | null;
  symbolismLabel: string | null;
  symbolismTitle: string | null;
  symbolismBody: string | null;
  symbolismBody2: string | null;
  details: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
  translations: ProductTranslationRecord[];
  tags: { tag: { slug: string; name: string } }[];
  collections: {
    collection: {
      slug: string;
      name: string;
      description: string | null;
      manifesto: string | null;
      symbolismLabel: string | null;
      symbolismTitle: string | null;
      symbolismBody: string | null;
      symbolismBody2: string | null;
      searchSummary: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
      isPrimaryNav: boolean;
      isStorefrontDefault: boolean;
      translations: Array<{
        locale: string;
        name: string;
        description: string | null;
        manifesto: string | null;
        symbolismLabel: string | null;
        symbolismTitle: string | null;
        symbolismBody: string | null;
        symbolismBody2: string | null;
        searchSummary: string | null;
        seoTitle: string | null;
        seoDescription: string | null;
      }>;
    };
  }[];
  characteristics: Array<{
    key: string; label: string; group: string; valueType: "TEXT" | "NUMBER" | "BOOLEAN";
    textValue: string | null; numberValue: { toString(): string } | null; booleanValue: boolean | null;
    unit: string | null; certificateUrl: string | null; sortOrder: number;
  }>;
  variants: Array<{
    status: string;
    shopifyVariantId: string | null;
    title: string;
    sku: string;
    barcode: string | null;
    stockOnHand: number;
    inventoryPolicy: string;
    tracked: boolean;
    priceCents: number;
    compareAtCents: number | null;
    weightGrams: { toString(): string } | null;
    selectedOptions: unknown;
  }>;
  media: Array<{
    alt: string | null;
    sortOrder: number;
    asset: { key: string; width: number | null; height: number | null };
  }>;
}, locale: Locale): ProductSummary {
  // "Collection" (curated/marketing grouping) and "department" (top-level
  // storefront navigation) are both ProductCollection membership now —
  // isPrimaryNav distinguishes which one a given membership row is.
  const leadCollection = product.collections.find(
    (item) => !item.collection.isPrimaryNav && !item.collection.isStorefrontDefault,
  )?.collection;
  const primaryNavCollection = product.collections.find((item) => item.collection.isPrimaryNav)?.collection ?? null;
  const leadCollectionCopy = leadCollection ? resolveCollectionCopy(leadCollection, locale) : null;
  const primaryNavCollectionName = primaryNavCollection ? resolveCollectionName(primaryNavCollection, locale) : "";
  const localized = resolveProductCopy(product, locale);
  const localizedHandle = product.translations.find((translation) => translation.locale === locale)?.localizedHandle;
  const activeSlug = resolveLocalizedHandle(locale, product.slug, localizedHandle);
  const details = parseProductDetails(localized.details);
  const process = {
    eyebrow: details.process?.eyebrow ?? "",
    title: details.process?.title ?? "",
    mediaImage: details.process?.mediaImage ?? "",
    stats: details.process?.stats ?? [],
  };
  // Commerce fields (SKU, price, compare-at) are owned by the variant —
  // Product's own copies exist only as an identity anchor for Shopify
  // pull's by-SKU matching, not as a display source of truth. The card
  // price must match what the PDP opens on, so this prefers the first
  // purchasable variant over the literal first-created one (REV-07);
  // ProductPurchasePanel's own initialVariant selection mirrors this.
  const primaryVariant = product.variants.find((variant) => isVariantPurchasable(variant)) ?? product.variants[0];
  const stockOnHand = product.variants.reduce((total, variant) => total + variant.stockOnHand, 0);
  const inStock = product.variants.some((variant) => isVariantPurchasable(variant));
  const priceCents = primaryVariant?.priceCents ?? product.priceCents;
  const compareAtCents = primaryVariant?.compareAtCents ?? null;
  const projection = shopifyProjection(product.shopifySnapshot);
  const localMedia = product.media.map((item) => ({
    src: getS3PublicUrl(item.asset.key),
    alt: item.alt ?? localized.title,
    width: item.asset.width,
    height: item.asset.height,
  }));
  const combinedMedia = combineProductGallery(
    product.imageUrl ? { src: product.imageUrl, alt: localized.title, width: null, height: null } : null,
    localMedia,
    projection.media,
  );
  return {
    shopifyProductId: product.shopifyProductId,
    slug: activeSlug,
    sourceSlug: product.slug,
    sku: primaryVariant?.sku ?? product.sku,
    series: product.seriesLabel ?? "",
    title: localized.title,
    shortDescription: localized.shortDescription,
    description: localized.description,
    seoTitle: localized.seoTitle,
    seoDescription: localized.seoDescription,
    price: priceFromCents(priceCents, product.currency, locale),
    priceAmount: priceCents / 100,
    currency: product.currency,
    compareAtPrice: compareAtCents == null ? "" : priceFromCents(compareAtCents, product.currency, locale),
    compareAtAmount: compareAtCents == null ? null : compareAtCents / 100,
    stockOnHand,
    inStock,
    searchText: [
      product.slug,
      product.sku,
      product.seriesLabel,
      product.searchSummary,
      product.searchDocument,
      localized.title,
      localized.shortDescription,
      localized.description,
      localized.materialLine,
      product.shopifyCategoryName,
      primaryNavCollectionName,
      ...product.tags.flatMap((item) => [item.tag.slug, item.tag.name]),
    ].filter(Boolean).join(" "),
    variantCount: product.variants.length,
    vendor: product.vendor ?? "",
    productType: product.productType ?? "",
    shopifyCategoryName: product.shopifyCategoryName ?? "",
    commerceMedia: combinedMedia,
    options: projection.options.filter((option) => option.name !== "Title" || option.values.some((value) => value !== "Default Title")),
    variantDetails: product.variants.map((variant) => {
      const selectedOptions = Array.isArray(variant.selectedOptions)
        ? variant.selectedOptions.flatMap((item) => {
            const row = asRecord(item);
            return typeof row.name === "string" && typeof row.value === "string"
              ? [{ name: row.name, value: row.value }]
              : [];
          })
        : [];
      return {
        merchandiseId: variant.shopifyVariantId,
        title: variant.title,
        sku: variant.sku,
        barcode: variant.barcode ?? "",
        price: priceFromCents(variant.priceCents, product.currency, locale),
        priceAmount: variant.priceCents / 100,
        compareAtPrice: variant.compareAtCents == null ? "" : priceFromCents(variant.compareAtCents, product.currency, locale),
        compareAtAmount: variant.compareAtCents == null ? null : variant.compareAtCents / 100,
        stockOnHand: variant.stockOnHand,
        available: isVariantPurchasable(variant),
        weightGrams: variant.weightGrams == null ? null : Number(variant.weightGrams),
        selectedOptions,
      };
    }),
    image: storefrontMedia(product.imageUrl, product.slug),
    collectionSlug: leadCollection?.slug ?? "",
    collectionSlugs: product.collections.map((item) => item.collection.slug),
    collectionName: leadCollectionCopy?.name ?? "",
    materialLine: localized.materialLine,
    departmentSlug: primaryNavCollection?.slug ?? null,
    departmentName: primaryNavCollectionName,
    attributes: product.characteristics.length
      ? product.characteristics.map((item) => ({ label: characteristicLabel(item.key, item.label, locale), value: characteristicDisplayValue({ ...item, numberValue: item.numberValue == null ? null : Number(item.numberValue) }, locale) }))
      : details.attributes ?? [],
    characteristics: product.characteristics.map((item) => ({
      ...item,
      label: characteristicLabel(item.key, item.label, locale),
      numberValue: item.numberValue == null ? null : Number(item.numberValue),
    })),
    categorySlug: product.shopifyCategoryId,
    categoryName: categoryLeafLabel(product.shopifyCategoryName),
    tagSlugs: product.tags.map((item) => item.tag.slug),
    tagNames: product.tags.map((item) => item.tag.name),
    publicMetafields: projection.publicMetafields,
    symbolismLabel: localized.symbolismLabel || leadCollectionCopy?.symbolismLabel || "",
    symbolismTitle: localized.symbolismTitle || leadCollectionCopy?.symbolismTitle || "",
    symbolismBody: localized.symbolismBody || leadCollectionCopy?.symbolismBody || "",
    symbolismBody2: localized.symbolismBody2 || leadCollectionCopy?.symbolismBody2 || "",
    materialsEyebrow: details.materialsEyebrow ?? "",
    materialsTitle: details.materialsTitle ?? "",
    materials: details.materials ?? [],
    process,
    lookbookEyebrow: details.lookbookEyebrow ?? "",
    lookbookTitle: details.lookbookTitle ?? "",
    lookbook: details.lookbook ?? [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

/**
 * The storefront's top-level navigation departments — Shopify-backed
 * collections marked `isPrimaryNav`, replacing the hard-coded
 * `SHOP_DEPARTMENTS` list. Seeded once by migration
 * `20260907223000_add_collection_primary_navigation`; admin can add more
 * by marking another collection primary-nav.
 */
export async function getStorefrontNavigation(locale: Locale = "en") {
  const collections = await db.collection.findMany({
    where: { isPrimaryNav: true, status: "ACTIVE", visibility: "PUBLIC" },
    orderBy: [{ navSortOrder: "asc" }, { name: "asc" }],
    include: { translations: true },
  });
  return collections.map((collection) => ({
    slug: resolveLocalizedHandle(locale, collection.slug, collection.translations.find((translation) => translation.locale === locale)?.localizedHandle),
    name: resolveCollectionCopy(collection, locale).name,
  }));
}

export async function getShopFilterData(locale: Locale = "en") {
  const [departments, categoryRows, productTypeRows, tags, collections, characteristicRows] = await Promise.all([
    getStorefrontNavigation(locale),
    // Category is Shopify Standard Product Taxonomy now (item 1) — there's
    // no local category table to browse, so the filter options are just
    // the distinct categories actually in use, like materials/finishes below.
    db.product.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC", shopifyCategoryId: { not: null } },
      select: { shopifyCategoryId: true, shopifyCategoryName: true },
      distinct: ["shopifyCategoryId"],
      orderBy: { shopifyCategoryName: "asc" },
    }),
    db.product.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC", productType: { not: null } },
      select: { productType: true },
      distinct: ["productType"],
      orderBy: { productType: "asc" },
    }),
    db.tag.findMany({
      orderBy: { name: "asc" },
    }),
    db.collection.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC", isPrimaryNav: false, isStorefrontDefault: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { translations: true },
    }),
    db.productCharacteristic.findMany({
      where: { filterable: true, textValue: { not: null }, product: { status: "ACTIVE", visibility: "PUBLIC" } },
      select: { key: true, textValue: true },
      distinct: ["key", "textValue"],
      orderBy: { textValue: "asc" },
    }),
  ]);

  const categories = categoryRows.map((row) => ({
    slug: row.shopifyCategoryId!,
    name: categoryLeafLabel(row.shopifyCategoryName) || row.shopifyCategoryId!,
  }));
  const productTypes = productTypeRows.flatMap((row) => {
    const value = row.productType?.trim();
    return value ? [{ slug: value, name: value }] : [];
  });
  const values = (key: string) => characteristicRows.filter((item) => item.key === key && item.textValue).map((item) => ({ slug: item.textValue!, name: item.textValue! }));
  return {
    departments,
    categories,
    productTypes,
    tags,
    collections: collections.map((collection) => ({
      ...collection,
      name: resolveCollectionName(collection, locale),
    })),
    materials: values("material"),
    finishes: values("finish"),
    origins: values("origin"),
  };
}

export async function listCollections(locale: Locale = "en") {
  const collections = await db.collection.findMany({
    where: {
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
    include: { translations: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return collections.map((collection) => {
    const copy = resolveCollectionCopy(collection, locale);
    return {
      slug: resolveLocalizedHandle(locale, collection.slug, collection.translations.find((translation) => translation.locale === locale)?.localizedHandle),
      sourceSlug: collection.slug,
      name: copy.name,
      eyebrow: formatCollectionEyebrow(collection.sortOrder),
      summary: copy.description,
      heroImage: storefrontMedia(collection.heroImageUrl, collection.slug),
      accent: collection.code ?? "",
      updatedAt: collection.updatedAt,
    };
  });
}

export async function getCollectionBySlug(slug: string, locale: Locale = "en") {
  let collection = await db.collection.findFirst({
    where: locale === "en"
      ? { slug }
      : { OR: [{ slug }, { translations: { some: { locale, localizedHandle: slug } } }] },
    include: { translations: true },
  });
  if (!collection && locale !== "en") {
    const oldHandle = await findLocalizedHandleRedirect("COLLECTION", locale, slug);
    if (oldHandle) collection = await db.collection.findUnique({ where: { id: oldHandle.entityId }, include: { translations: true } });
  }

  if (!collection || collection.status !== "ACTIVE" || collection.visibility !== "PUBLIC") {
    return null;
  }

  const copy = resolveCollectionCopy(collection, locale);
  const activeSlug = resolveLocalizedHandle(locale, collection.slug, collection.translations.find((translation) => translation.locale === locale)?.localizedHandle);
  return {
    slug: activeSlug,
    sourceSlug: collection.slug,
    name: copy.name,
    eyebrow: formatCollectionEyebrow(collection.sortOrder),
    summary: copy.description,
    heroImage: storefrontMedia(collection.heroImageUrl, collection.slug),
    accent: collection.code ?? "",
    manifesto: copy.manifesto,
    symbolismLabel: copy.symbolismLabel,
    symbolismTitle: copy.symbolismTitle,
    symbolismBody: copy.symbolismBody,
    symbolismBody2: copy.symbolismBody2,
    updatedAt: collection.updatedAt,
  };
}

function formatCollectionEyebrow(sortOrder: number | null | undefined) {
  if (!Number.isFinite(sortOrder) || (sortOrder ?? 0) <= 0) {
    return "Collection";
  }

  return `Collection ${String(sortOrder).padStart(2, "0")}`;
}

/**
 * Real Shopify sales ranking (Collection.products sortKey: BEST_SELLING) for
 * the whole catalog, read off the same `isStorefrontDefault` collection used
 * for global priority. Returns null — falling back to the default sort —
 * when that collection isn't configured yet or Shopify can't be reached, so
 * a live storefront request never 500s on this.
 */
async function getBestSellingProductRank(): Promise<Map<string, number> | null> {
  const collection = await db.collection.findFirst({
    where: { isStorefrontDefault: true, shopifyCollectionId: { not: null } },
    select: { shopifyCollectionId: true },
  });
  if (!collection?.shopifyCollectionId) return null;
  try {
    const orderedIds = await getCachedShopifyCollectionBestSelling(collection.shopifyCollectionId);
    return new Map(orderedIds.map((id, index) => [id, index]));
  } catch {
    return null;
  }
}

export async function listBestSellingShopifyProductIds(): Promise<string[] | null> {
  const rank = await getBestSellingProductRank();
  return rank ? [...rank.keys()] : null;
}

export async function listShopProducts(
  filters: ShopFilters = {},
  options: { shopifyProductIds?: string[]; limit?: number; locale?: Locale } = {},
) {
  if (options.shopifyProductIds?.length === 0) return [];
  const locale = options.locale ?? await getRequestLocale();
  const q = filters.q?.trim();
  const sort = normalizeShopSort(filters.sort);
  const orderBy = sort === "newest"
    ? [{ createdAt: "desc" as const }]
    : sort === "price-asc"
      ? [{ priceCents: "asc" as const }, { createdAt: "desc" as const }]
      : sort === "price-desc"
        ? [{ priceCents: "desc" as const }, { createdAt: "desc" as const }]
        : sort === "name-asc"
          ? [{ name: "asc" as const }]
          : [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }];

  const products = await db.product.findMany({
    where: {
      status: "ACTIVE",
      visibility: "PUBLIC",
      ...(options.shopifyProductIds ? { shopifyProductId: { in: options.shopifyProductIds } } : {}),
      ...(filters.category ? { shopifyCategoryId: filters.category } : {}),
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
      ...(filters.tag
        ? {
            tags: {
              some: {
                tag: {
                  slug: filters.tag,
                },
              },
            },
          }
        : {}),
      ...(filters.collection
        ? {
            collections: {
              some: {
                collection: {
                  slug: filters.collection,
                },
              },
            },
          }
        : {}),
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
    },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      collections: {
        include: {
          collection: {
            select: {
              slug: true,
              name: true,
              description: true,
              manifesto: true,
              symbolismLabel: true,
              symbolismTitle: true,
              symbolismBody: true,
              symbolismBody2: true,
              searchSummary: true,
              seoTitle: true,
              seoDescription: true,
              isPrimaryNav: true,
              isStorefrontDefault: true,
              translations: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      characteristics: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
      variants: { orderBy: { createdAt: "asc" } },
      media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { asset: true } },
      translations: true,
    },
    orderBy,
    ...(options.limit ? { take: options.limit } : {}),
  });

  const bestSellingRank = sort === "popular" ? await getBestSellingProductRank() : null;

  const orderedProducts = sort === "featured"
    ? [...products].sort((left, right) => (
        featuredCollectionPosition(left.collections, filters.collection)
        - featuredCollectionPosition(right.collections, filters.collection)
      ))
    : bestSellingRank
      ? [...products].sort((left, right) => (
          (bestSellingRank.get(left.shopifyProductId ?? "") ?? Number.POSITIVE_INFINITY)
          - (bestSellingRank.get(right.shopifyProductId ?? "") ?? Number.POSITIVE_INFINITY)
        ))
      : products;

  const localizedProducts = orderedProducts
    .map((product) => toSummary(product, locale))
    .filter((product) => product.image)
    .filter((product) => !filters.department || product.departmentSlug === filters.department);

  // price-asc/desc re-sort here rather than trusting the DB-level orderBy above:
  // Product.priceCents is a snapshot from the last Shopify pull's first variant,
  // while ProductSummary.priceAmount reflects the first *purchasable* variant
  // (REV-07) — the two can disagree once a cheaper variant sells out.
  return sort === "name-asc"
    ? localizedProducts.sort((left, right) => left.title.localeCompare(right.title, locale))
    : sort === "price-asc"
      ? localizedProducts.sort((left, right) => left.priceAmount - right.priceAmount)
      : sort === "price-desc"
        ? localizedProducts.sort((left, right) => right.priceAmount - left.priceAmount)
        : localizedProducts;
}

export async function getProductBySlug(slug: string, requestedLocale?: Locale) {
  const locale = requestedLocale ?? await getRequestLocale();
  let product = await db.product.findFirst({
    where: locale === "en"
      ? { slug }
      : { OR: [{ slug }, { translations: { some: { locale, localizedHandle: slug } } }] },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      collections: {
        include: {
          collection: {
            select: {
              slug: true,
              name: true,
              description: true,
              manifesto: true,
              symbolismLabel: true,
              symbolismTitle: true,
              symbolismBody: true,
              symbolismBody2: true,
              searchSummary: true,
              seoTitle: true,
              seoDescription: true,
              isPrimaryNav: true,
              isStorefrontDefault: true,
              translations: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      characteristics: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
      variants: { orderBy: { createdAt: "asc" } },
      media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { asset: true } },
      translations: true,
    },
  });
  if (!product && locale !== "en") {
    const oldHandle = await findLocalizedHandleRedirect("PRODUCT", locale, slug);
    if (oldHandle) {
      product = await db.product.findUnique({
        where: { id: oldHandle.entityId },
        include: {
          tags: { include: { tag: true } },
          collections: { include: { collection: { include: { translations: true } } }, orderBy: { sortOrder: "asc" } },
          characteristics: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
          variants: { orderBy: { createdAt: "asc" } },
          media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { asset: true } },
          translations: true,
        },
      });
    }
  }

  if (!product || !isSynaravaProductAccessible(product.status, product.visibility)) {
    return null;
  }

  return toSummary(product, locale);
}

export async function getProductsByCollection(slug: string, locale?: Locale) {
  const resolvedLocale = locale ?? await getRequestLocale();
  const collection = await getCollectionBySlug(slug, resolvedLocale);
  return collection ? listShopProducts({ collection: collection.sourceSlug }, { locale: resolvedLocale }) : [];
}

export async function getPageBySlug(slug: string, requestedLocale?: Locale) {
  const locale = requestedLocale ?? await getRequestLocale();
  let page = await db.page.findFirst({
    where: locale === "en"
      ? { slug }
      : { OR: [{ slug }, { translations: { some: { locale, localizedHandle: slug } } }] },
    include: {
      translations: {
        where: { locale },
      },
    },
  });
  if (!page && locale !== "en") {
    const oldHandle = await findLocalizedHandleRedirect("PAGE", locale, slug);
    if (oldHandle) {
      page = await db.page.findUnique({
        where: { id: oldHandle.entityId },
        include: { translations: { where: { locale } } },
      });
    }
  }

  if (!page || page.status !== "PUBLISHED" || page.visibility !== "PUBLIC") {
    return null;
  }

  const content = (page.content ?? {}) as PageContent;
  const normalizedTranslation = page.translations?.[0] ?? null;
  const resolved = resolvePageLocalizedCopy({
    locale,
    source: { title: page.title, excerpt: page.excerpt, content: content as Record<string, unknown> },
    translation: normalizedTranslation,
    legacyTranslation: locale === "pt" ? content.translations?.pt as Record<string, unknown> | undefined : undefined,
  });

  return {
    slug: resolveLocalizedHandle(locale, page.slug, normalizedTranslation?.localizedHandle),
    sourceSlug: page.slug,
    title: resolved.title,
    excerpt: resolved.excerpt,
    content: resolved.content as PageContent,
  };
}

export async function getAdminCatalogData() {
  const [pages, rawProducts, categoryRows, tags, collections, issues] = await Promise.all([
    db.page.findMany({
      include: { translations: { orderBy: { locale: "asc" } } },
      orderBy: { slug: "asc" },
    }),
    db.product.findMany({
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        collections: {
          include: {
            collection: true,
          },
        },
        characteristics: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
        variants: { orderBy: { createdAt: "asc" } },
        media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { asset: true } },
        translations: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    // Category is Shopify Standard Product Taxonomy now (item 1) — options
    // are the distinct categories actually assigned to a product, not a
    // separate local table.
    db.product.findMany({
      where: { shopifyCategoryId: { not: null } },
      select: { shopifyCategoryId: true, shopifyCategoryName: true },
      distinct: ["shopifyCategoryId"],
      orderBy: { shopifyCategoryName: "asc" },
    }),
    db.tag.findMany({
      orderBy: { name: "asc" },
    }),
    db.collection.findMany({
      include: { translations: { orderBy: { locale: "asc" } } },
      orderBy: { name: "asc" },
    }),
    db.adminIssue.findMany({
      where: { status: "OPEN" },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const products = rawProducts.map((product) => ({
    ...product,
    media: product.media.map((item) => ({
      id: item.id, assetId: item.assetId, kind: item.kind, alt: item.alt, caption: item.caption,
      sortOrder: item.sortOrder, url: getS3PublicUrl(item.asset.key), width: item.asset.width, height: item.asset.height,
    })),
    characteristics: product.characteristics.map((item) => ({
      ...item,
      numberValue: item.numberValue == null ? null : Number(item.numberValue),
    })),
    variants: product.variants.map((variant) => ({
      ...variant,
      weightGrams: variant.weightGrams == null ? null : Number(variant.weightGrams),
    })),
  }));
  const categories = categoryRows.map((row) => ({
    slug: row.shopifyCategoryId!,
    name: row.shopifyCategoryName ?? row.shopifyCategoryId!,
  }));
  return { pages, products, categories, tags, collections, issues };
}
