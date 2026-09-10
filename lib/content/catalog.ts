import { db } from "@/lib/db";
import type { ShopDepartmentSlug } from "@/lib/catalog/taxonomy";
import {
  parseProductDetails,
  type ProductAttribute,
  type ProductLookbookStory,
  type ProductMaterialStory,
  type ProductProcessStory,
} from "@/lib/content/product-details";
import { characteristicDisplayValue, type ProductCharacteristicValue } from "@/lib/products/characteristics";
import { storefrontMedia } from "@/lib/content/media-fallbacks";
import { normalizeShopSort, type ShopSort } from "@/lib/catalog/shop-sort";
import { formatCurrency } from "@/lib/i18n/format";
import { getRequestLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locales";
import { getS3PublicUrl } from "@/lib/s3";
import { combineProductGallery } from "@/lib/media/product-gallery";
import { isSynaravaProductAccessible } from "@/lib/shopify/reconciliation";
import {
  resolveProductCopy,
  type ProductTranslationRecord,
} from "@/lib/products/localization";
import { storefrontLocaleToContentLocale } from "@/lib/i18n/localized-content";

export type CollectionSummary = {
  slug: string;
  name: string;
  eyebrow: string;
  summary: string;
  heroImage: string;
  accent: string;
  updatedAt: Date;
};

export type ProductSummary = {
  slug: string;
  sku: string;
  series: string;
  title: string;
  shortDescription: string;
  description: string;
  price: string;
  priceAmount: number;
  currency: string;
  compareAtPrice: string;
  compareAtAmount: number | null;
  stockOnHand: number;
  variantCount: number;
  vendor: string;
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
    weightGrams: number | null;
    selectedOptions: Array<{ name: string; value: string }>;
  }>;
  image: string;
  collectionSlug: string;
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
};

export type ShopFilters = {
  q?: string;
  department?: string;
  availability?: "in-stock" | string;
  category?: string;
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
  translations?: {
    pt?: Omit<PageContent, "translations" | "heroImage"> & {
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
  };
}

function toSummary(product: {
  slug: string;
  sku: string;
  name: string;
  seriesLabel: string | null;
  shortDescription: string | null;
  description: string | null;
  priceCents: number;
  currency: string;
  updatedAt: Date;
  vendor: string | null;
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
      symbolismLabel: string | null;
      symbolismTitle: string | null;
      symbolismBody: string | null;
      symbolismBody2: string | null;
      isPrimaryNav: boolean;
    };
  }[];
  characteristics: Array<{
    key: string; label: string; group: string; valueType: "TEXT" | "NUMBER" | "BOOLEAN";
    textValue: string | null; numberValue: { toString(): string } | null; booleanValue: boolean | null;
    unit: string | null; certificateUrl: string | null; sortOrder: number;
  }>;
  variants: Array<{
    shopifyVariantId: string | null;
    title: string;
    sku: string;
    barcode: string | null;
    stockOnHand: number;
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
  const leadCollection = product.collections.find((item) => !item.collection.isPrimaryNav)?.collection;
  const primaryNavCollection = product.collections.find((item) => item.collection.isPrimaryNav)?.collection ?? null;
  const localized = resolveProductCopy(product, locale);
  const details = parseProductDetails(localized.details);
  const process = {
    eyebrow: details.process?.eyebrow ?? "",
    title: details.process?.title ?? "",
    mediaImage: details.process?.mediaImage ?? "",
    stats: details.process?.stats ?? [],
  };
  // Commerce fields (SKU, price, compare-at) are owned by the variant —
  // Product's own copies exist only as an identity anchor for Shopify
  // pull's by-SKU matching, not as a display source of truth.
  const primaryVariant = product.variants[0];
  const stockOnHand = product.variants.reduce((total, variant) => total + variant.stockOnHand, 0);
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
    slug: product.slug,
    sku: primaryVariant?.sku ?? product.sku,
    series: product.seriesLabel ?? "",
    title: localized.title,
    shortDescription: localized.shortDescription,
    description: localized.description,
    price: priceFromCents(priceCents, product.currency, locale),
    priceAmount: priceCents / 100,
    currency: product.currency,
    compareAtPrice: compareAtCents == null ? "" : priceFromCents(compareAtCents, product.currency, locale),
    compareAtAmount: compareAtCents == null ? null : compareAtCents / 100,
    stockOnHand,
    variantCount: product.variants.length,
    vendor: product.vendor ?? "",
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
        weightGrams: variant.weightGrams == null ? null : Number(variant.weightGrams),
        selectedOptions,
      };
    }),
    image: storefrontMedia(product.imageUrl, product.slug),
    collectionSlug: leadCollection?.slug ?? "",
    collectionName: leadCollection?.name ?? "",
    materialLine: localized.materialLine,
    departmentSlug: primaryNavCollection?.slug ?? null,
    departmentName: primaryNavCollection?.name ?? "",
    attributes: product.characteristics.length
      ? product.characteristics.map((item) => ({ label: item.label, value: characteristicDisplayValue({ ...item, numberValue: item.numberValue == null ? null : Number(item.numberValue) }) }))
      : details.attributes ?? [],
    characteristics: product.characteristics.map((item) => ({ ...item, numberValue: item.numberValue == null ? null : Number(item.numberValue) })),
    categorySlug: product.shopifyCategoryId,
    categoryName: product.shopifyCategoryName,
    tagSlugs: product.tags.map((item) => item.tag.slug),
    tagNames: product.tags.map((item) => item.tag.name),
    symbolismLabel: localized.symbolismLabel || leadCollection?.symbolismLabel || "",
    symbolismTitle: localized.symbolismTitle || leadCollection?.symbolismTitle || "",
    symbolismBody: localized.symbolismBody || leadCollection?.symbolismBody || "",
    symbolismBody2: localized.symbolismBody2 || leadCollection?.symbolismBody2 || "",
    materialsEyebrow: details.materialsEyebrow ?? "",
    materialsTitle: details.materialsTitle ?? "",
    materials: details.materials ?? [],
    process,
    lookbookEyebrow: details.lookbookEyebrow ?? "",
    lookbookTitle: details.lookbookTitle ?? "",
    lookbook: details.lookbook ?? [],
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
export async function getStorefrontNavigation() {
  const collections = await db.collection.findMany({
    where: { isPrimaryNav: true, status: "ACTIVE", visibility: "PUBLIC" },
    orderBy: [{ navSortOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true },
  });
  return collections;
}

export async function getShopFilterData() {
  const [departments, categoryRows, tags, collections, characteristicRows] = await Promise.all([
    getStorefrontNavigation(),
    // Category is Shopify Standard Product Taxonomy now (item 1) — there's
    // no local category table to browse, so the filter options are just
    // the distinct categories actually in use, like materials/finishes below.
    db.product.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC", shopifyCategoryId: { not: null } },
      select: { shopifyCategoryId: true, shopifyCategoryName: true },
      distinct: ["shopifyCategoryId"],
      orderBy: { shopifyCategoryName: "asc" },
    }),
    db.tag.findMany({
      orderBy: { name: "asc" },
    }),
    db.collection.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC", isPrimaryNav: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
    name: row.shopifyCategoryName ?? row.shopifyCategoryId!,
  }));
  const values = (key: string) => characteristicRows.filter((item) => item.key === key && item.textValue).map((item) => ({ slug: item.textValue!, name: item.textValue! }));
  return { departments, categories, tags, collections, materials: values("material"), finishes: values("finish"), origins: values("origin") };
}

export async function listCollections() {
  const collections = await db.collection.findMany({
    where: {
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return collections.map((collection) => ({
    slug: collection.slug,
    name: collection.name,
    eyebrow: formatCollectionEyebrow(collection.sortOrder),
    summary: collection.description ?? "",
    heroImage: storefrontMedia(collection.heroImageUrl, collection.slug),
    accent: collection.code ?? "",
    updatedAt: collection.updatedAt,
  }));
}

export async function getCollectionBySlug(slug: string) {
  const collection = await db.collection.findUnique({
    where: { slug },
  });

  if (!collection || collection.status !== "ACTIVE" || collection.visibility !== "PUBLIC") {
    return null;
  }

  return {
    slug: collection.slug,
    name: collection.name,
    eyebrow: formatCollectionEyebrow(collection.sortOrder),
    summary: collection.description ?? "",
    heroImage: storefrontMedia(collection.heroImageUrl, collection.slug),
    accent: collection.code ?? "",
    manifesto: collection.manifesto ?? "",
    symbolismLabel: collection.symbolismLabel ?? "",
    symbolismTitle: collection.symbolismTitle ?? "",
    symbolismBody: collection.symbolismBody ?? "",
    symbolismBody2: collection.symbolismBody2 ?? "",
    updatedAt: collection.updatedAt,
  };
}

function formatCollectionEyebrow(sortOrder: number | null | undefined) {
  if (!Number.isFinite(sortOrder) || (sortOrder ?? 0) <= 0) {
    return "Collection";
  }

  return `Collection ${String(sortOrder).padStart(2, "0")}`;
}

export async function listShopProducts(filters: ShopFilters = {}) {
  const locale = await getRequestLocale();
  const contentLocale = storefrontLocaleToContentLocale(locale);
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
      ...(filters.category ? { shopifyCategoryId: filters.category } : {}),
      ...(filters.availability === "in-stock"
        ? { variants: { some: { status: "ACTIVE", stockOnHand: { gt: 0 } } } }
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
                    locale: contentLocale,
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
              symbolismLabel: true,
              symbolismTitle: true,
              symbolismBody: true,
              symbolismBody2: true,
              isPrimaryNav: true,
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
  });

  const localizedProducts = products
    .map((product) => toSummary(product, locale))
    .filter((product) => product.image)
    .filter((product) => !filters.department || product.departmentSlug === filters.department);

  return sort === "name-asc"
    ? localizedProducts.sort((left, right) => left.title.localeCompare(right.title, locale))
    : localizedProducts;
}

export async function getProductBySlug(slug: string) {
  const locale = await getRequestLocale();
  const product = await db.product.findUnique({
    where: { slug },
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
              symbolismLabel: true,
              symbolismTitle: true,
              symbolismBody: true,
              symbolismBody2: true,
              isPrimaryNav: true,
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

  if (!product || !isSynaravaProductAccessible(product.status, product.visibility)) {
    return null;
  }

  return toSummary(product, locale);
}

export async function getProductsByCollection(slug: string) {
  return listShopProducts({ collection: slug });
}

export async function getPageBySlug(slug: string) {
  const locale = await getRequestLocale();
  const page = await db.page.findUnique({
    where: { slug },
  });

  if (!page || page.status !== "PUBLISHED" || page.visibility !== "PUBLIC") {
    return null;
  }

  const content = (page.content ?? {}) as PageContent;
  const translation = locale === "pt" ? content.translations?.pt : undefined;

  return {
    slug: page.slug,
    title: translation?.title || page.title,
    excerpt: translation?.excerpt || page.excerpt || "",
    content: translation ? { ...content, ...translation, translations: content.translations } : content,
  };
}

export async function getAdminCatalogData() {
  const [pages, rawProducts, categoryRows, tags, collections, issues] = await Promise.all([
    db.page.findMany({
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
