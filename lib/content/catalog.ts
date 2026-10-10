import { RETIRED_PAGE_SLUGS } from "@/lib/content/built-in-pages";
import type { ShopPageCopy } from "@/lib/content/shop-page-copy";
import { db } from "@/lib/db";
import {
  parseProductDetails,
  type ProductAttribute,
  type ProductLookbookStory,
  type ProductMaterialStory,
  type ProductProcessStory,
} from "@/lib/content/product-details";
import {
  characteristicLabel,
  parseCharacteristicTextOverlay,
  type ProductCharacteristicValue,
} from "@/lib/products/characteristics";
import {
  buildCharacteristicFacetLabelMap,
  characteristicFacetLabel,
  buyerFacingTagNames,
  localizeShopFacetValue,
  resolvePdpCharacteristicDisplayValue,
} from "@/lib/catalog/shop-facet-labels";
import { getTaxonomyFacetLabelMap } from "@/lib/catalog/taxonomy-value-labels";
import { projectPublicProductMetafields } from "@/lib/shopify/public-metafields";
import {
  characteristicOverlayFromMetafieldTranslations,
  mergeCharacteristicDisplayOverlay,
  storefrontMetafieldTranslations,
  type MetafieldTranslations,
} from "@/lib/shopify/product-metafields-shared";
import { storefrontMedia } from "@/lib/content/media-fallbacks";
import { normalizeShopSort, type ShopSort } from "@/lib/catalog/shop-sort";
import { featuredCollectionPosition } from "@/lib/catalog/collection-order";
import { buildShopProductWhere } from "@/lib/catalog/shop-where";
import { getCachedShopifyCollectionBestSelling } from "@/lib/shopify/collection-order";
import { formatCurrency } from "@/lib/i18n/format";
import { getRequestLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locales";
import { getS3PublicUrl } from "@/lib/s3";
import { combineProductGallery } from "@/lib/media/product-gallery";
import { mediaFramesFromWorkingSnapshot } from "@/lib/shopify/shopify-snapshot-media";
import { isSynaravaProductAccessible } from "@/lib/shopify/reconciliation";
import { isVariantPurchasable } from "@/lib/commerce/variant-availability";
import {
  resolveProductCopy,
  type ProductTranslationRecord,
} from "@/lib/products/localization";
import { resolveCollectionCtaLabel } from "@/lib/collections/hero-cta";
import { resolveCollectionCopy, resolveCollectionName } from "@/lib/collections/localization";
import { ownedLocalizedPageFields, resolvePageLocalizedCopy } from "@/lib/pages/localization";
import { resolveLocalizedHandle } from "@/lib/content/handle-localization";
import { findLocalizedHandleRedirect } from "@/lib/content/handle-redirects";
import { normalizeCustomerCareContent } from "@/lib/content/customer-care-email";
import {
  formatCollectionEyebrow,
  shippedCollectionEyebrowLabel,
} from "@/lib/content/collection-eyebrow";

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
  id: string;
  createdAt?: Date;
  slug: string;
  sourceSlug: string;
  name: string;
  eyebrow: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
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
  calloutEyebrow?: string;
  calloutHeading?: string;
  calloutCtaHref?: string;
  heroOpeningLabel?: string;
  heroCountLabel?: string;
  heroQualifier?: string;
  detailShopLabel?: string;
  detailCollectionsLabel?: string;
  detailScrollLabel?: string;
  detailManifestoEyebrow?: string;
  detailManifestoGhost?: string;
  detailStoryEyebrow?: string;
  detailAccentCodeLabel?: string;
  detailTeaserEyebrow?: string;
  detailTeaserHeading?: string;
  detailTeaserShopLabel?: string;
  detailCatalogEyebrow?: string;
  detailCatalogHeading?: string;
  quote?: string;
  secondaryTitle?: string;
  secondaryBody?: string;
  heroImage?: string;
  heroSectionEnabled?: boolean;
  archiveSectionEnabled?: boolean;
  editSectionEnabled?: boolean;
  materialSectionEnabled?: boolean;
  manifestoSectionEnabled?: boolean;
  finalCtaSectionEnabled?: boolean;
  archiveSectionLabel?: string;
  editSectionEyebrow?: string;
  editSectionTitle?: string;
  editSectionBody?: string;
  editSectionViewAllLabel?: string;
  editProductIds?: string[];
  finalCtaProductIds?: string[];
  archiveCollectionIds?: string[];
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
  finalSecondaryCtaLabel?: string;
  finalSecondaryCtaHref?: string;
  finalFooterTitle?: string;
  finalContactLabel?: string;
  finalContactEmail?: string;
  finalContactEnabled?: boolean;
  legalIntro?: string;
  legalLastUpdated?: string;
  legalLastUpdatedLabel?: string;
  legalSections?: Array<{ id: string; label?: string; title?: string; body?: string }>
    | Record<string, { label?: string; title?: string; body?: string }>;
  serviceSections?: Array<{ id: string; label?: string; title?: string; body?: string }>
    | Record<string, { label?: string; title?: string; body?: string }>;
  translations?: {
    pt?: Omit<PageContent,
      | "translations"
      | "heroImage"
      | "heroSectionEnabled"
      | "archiveSectionEnabled"
      | "editSectionEnabled"
      | "editProductIds"
      | "finalCtaProductIds"
      | "archiveCollectionIds"
      | "materialSectionEnabled"
      | "manifestoSectionEnabled"
      | "finalCtaSectionEnabled"
      | "finalContactEnabled"
    > & {
      title?: string;
      excerpt?: string;
    };
  };
} & ShopPageCopy;

function priceFromCents(priceCents: number, currency: string, locale: Locale) {
  return formatCurrency(priceCents / 100, currency, locale);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function shopifyProjection(
  value: unknown,
  locale: Locale = "en",
  characteristicTextOverlay: Record<string, string> = {},
  metafieldTranslations?: MetafieldTranslations,
) {
  const snapshot = asRecord(value);
  const options = Array.isArray(snapshot.options) ? snapshot.options : [];
  return {
    // Prefer shared frame parser (id + preview/image URL) so gallery dedupe can key by MediaImage GID.
    media: mediaFramesFromWorkingSnapshot(value).map((frame) => ({
      id: frame.id,
      src: frame.url,
      alt: frame.alt,
      width: frame.width,
      height: frame.height,
    })),
    options: options.flatMap((item) => {
      const row = asRecord(item);
      if (typeof row.name !== "string") return [];
      return [{
        name: row.name,
        values: Array.isArray(row.values) ? row.values.filter((value): value is string => typeof value === "string") : [],
      }];
    }),
    publicMetafields: projectPublicProductMetafields(snapshot.metafields, {
      locale,
      snapshot,
      metafieldTranslations,
      // Passport TEXT overlays for mapped Shopify category/public facts (no Shopify sync).
      characteristicTextOverlay,
    }),
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
  workingSnapshot?: unknown;
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
}, locale: Locale, taxonomyOverlays?: Map<string, string> | null): ProductSummary {
  // Marketing collection membership excludes the storefront-default (Featured) row.
  const leadCollection = product.collections.find(
    (item) => !item.collection.isStorefrontDefault,
  )?.collection;
  const leadCollectionCopy = leadCollection ? resolveCollectionCopy(leadCollection, locale) : null;
  const localized = resolveProductCopy(product, locale);
  // Shared product.slug is the only storefront path — per-locale handles are retired.
  const activeSlug = product.slug;
  const details = parseProductDetails(localized.details);
  const passportTextOverlay = parseCharacteristicTextOverlay(localized.details);
  // OUR workingSnapshot owns Save-time PT/RU metafield overlays; shopifySnapshot
  // fills gaps from the last Pull (admin already prefers working ?? shopify).
  const mergedMetafieldTranslations = storefrontMetafieldTranslations(
    product.workingSnapshot,
    product.shopifySnapshot,
  );
  const shopifyMetafieldOverlay = characteristicOverlayFromMetafieldTranslations(
    mergedMetafieldTranslations[locale],
  );
  // Shopify Markets metafield translations win when present; Passport fills gaps.
  const characteristicTextOverlay = mergeCharacteristicDisplayOverlay(
    shopifyMetafieldOverlay,
    passportTextOverlay,
  );
  const commerceSnapshot = product.workingSnapshot ?? product.shopifySnapshot;
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
  // Options/metafields + gallery prefer OUR working tree (admin SoT), else last Pull.
  const projection = shopifyProjection(
    commerceSnapshot,
    locale,
    characteristicTextOverlay,
    mergedMetafieldTranslations,
  );
  const localMedia = product.media.map((item) => ({
    src: getS3PublicUrl(item.asset.key),
    alt: item.alt ?? localized.title,
    width: item.asset.width,
    height: item.asset.height,
  }));
  const workingMedia = mediaFramesFromWorkingSnapshot(
    product.workingSnapshot ?? product.shopifySnapshot,
  ).map((frame) => ({
    id: frame.id,
    src: frame.url,
    alt: frame.alt || localized.title,
    width: frame.width,
    height: frame.height,
  }));
  // Mirror admin Media: local ProductMedia rows OR snapshot tree — never both.
  // Still prepend imageUrl as cover, then dedupe by media id / normalized URL.
  const galleryFrames = localMedia.length > 0 ? localMedia : workingMedia;
  const combinedMedia = combineProductGallery(
    product.imageUrl ? { src: product.imageUrl, alt: localized.title, width: null, height: null } : null,
    galleryFrames,
    [],
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
      ...product.tags.flatMap((item) => [item.tag.slug, item.tag.name]),
    ].filter(Boolean).join(" "),
    variantCount: product.variants.length,
    vendor: product.vendor ?? "",
    // Keep EN identity for filters/match; display localizes in PDP specs via
    // the same overlay path as categoryName (DB → code map → EN).
    productType: localizeShopFacetValue(product.productType ?? "", locale, taxonomyOverlays),
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
    attributes: product.characteristics.length
      ? product.characteristics.map((item) => {
          const value: ProductCharacteristicValue = {
            ...item,
            numberValue: item.numberValue == null ? null : Number(item.numberValue),
          };
          return {
            label: characteristicLabel(item.key, item.label, locale),
            value: resolvePdpCharacteristicDisplayValue(
              value,
              locale,
              characteristicTextOverlay,
              taxonomyOverlays,
            ),
          };
        })
      : details.attributes ?? [],
    characteristics: product.characteristics.map((item) => {
      const value: ProductCharacteristicValue = {
        ...item,
        numberValue: item.numberValue == null ? null : Number(item.numberValue),
      };
      return {
        ...item,
        label: characteristicLabel(item.key, item.label, locale),
        numberValue: value.numberValue,
        textValue: item.valueType === "TEXT"
          ? resolvePdpCharacteristicDisplayValue(
            value,
            locale,
            characteristicTextOverlay,
            taxonomyOverlays,
          )
          : item.textValue,
      };
    }),
    categorySlug: product.shopifyCategoryId,
    categoryName: localizeShopFacetValue(
      categoryLeafLabel(product.shopifyCategoryName),
      locale,
      taxonomyOverlays,
    ),
    tagSlugs: product.tags.map((item) => item.tag.slug),
    tagNames: buyerFacingTagNames(product.tags.map((item) => item.tag.name)),
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

export async function getShopFilterData(locale: Locale = "en") {
  const [
    categoryRows,
    productTypeRows,
    tags,
    collections,
    characteristicRows,
    characteristicLocaleRows,
    taxonomyOverlays,
  ] = await Promise.all([
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
    // Tag facet removed from storefront (supportsTagFilters); keep the query
    // cheap for any admin/debug caller that still reads `tags`.
    Promise.resolve([] as Array<{ id: string; slug: string; name: string }>),
    db.collection.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC", isStorefrontDefault: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { translations: true },
    }),
    db.productCharacteristic.findMany({
      where: { filterable: true, textValue: { not: null }, product: { status: "ACTIVE", visibility: "PUBLIC" } },
      select: { key: true, textValue: true },
      distinct: ["key", "textValue"],
      orderBy: { textValue: "asc" },
    }),
    locale === "en"
      ? Promise.resolve([] as Array<{ key: string; textValue: string | null; details: unknown }>)
      : db.productCharacteristic.findMany({
          where: {
            filterable: true,
            textValue: { not: null },
            product: { status: "ACTIVE", visibility: "PUBLIC" },
          },
          select: {
            key: true,
            textValue: true,
            product: {
              select: {
                translations: {
                  where: { locale },
                  select: { details: true },
                  take: 1,
                },
              },
            },
          },
        }).then((rows) => rows.map((row) => ({
          key: row.key,
          textValue: row.textValue,
          details: row.product.translations[0]?.details ?? null,
        }))),
    getTaxonomyFacetLabelMap(locale),
  ]);

  const materialOverlays = buildCharacteristicFacetLabelMap(characteristicLocaleRows, "material", locale);
  const finishOverlays = buildCharacteristicFacetLabelMap(characteristicLocaleRows, "finish", locale);
  const originOverlays = buildCharacteristicFacetLabelMap(characteristicLocaleRows, "origin", locale);

  const categories = categoryRows.map((row) => {
    const enLeaf = categoryLeafLabel(row.shopifyCategoryName) || row.shopifyCategoryId!;
    return {
      slug: row.shopifyCategoryId!,
      name: localizeShopFacetValue(enLeaf, locale, taxonomyOverlays),
    };
  });
  const productTypes = productTypeRows.flatMap((row) => {
    const value = row.productType?.trim();
    return value ? [{ slug: value, name: localizeShopFacetValue(value, locale, taxonomyOverlays) }] : [];
  });
  const values = (key: string, overlays: Map<string, string>) =>
    characteristicRows
      .filter((item) => item.key === key && item.textValue)
      .map((item) => ({
        slug: item.textValue!,
        name: characteristicFacetLabel(item.textValue!, locale, overlays),
      }));
  return {
    categories,
    productTypes,
    tags,
    collections: collections.map((collection) => ({
      ...collection,
      name: resolveCollectionName(collection, locale),
    })),
    materials: values("material", materialOverlays),
    finishes: values("finish", finishOverlays),
    origins: values("origin", originOverlays),
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
  const collectionLabel = await resolveCollectionEyebrowLabel(locale);

  return collections.map((collection) => {
    const copy = resolveCollectionCopy(collection, locale);
    return {
      id: collection.id,
      createdAt: collection.createdAt,
      slug: resolveLocalizedHandle(locale, collection.slug, collection.translations.find((translation) => translation.locale === locale)?.localizedHandle),
      sourceSlug: collection.slug,
      name: copy.name,
      eyebrow: formatCollectionEyebrow(collection.sortOrder, collectionLabel),
      summary: copy.description,
      seoTitle: copy.seoTitle,
      seoDescription: copy.seoDescription,
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
  const collectionLabel = await resolveCollectionEyebrowLabel(locale);
  return {
    id: collection.id,
    createdAt: collection.createdAt,
    slug: activeSlug,
    sourceSlug: collection.slug,
    name: copy.name,
    eyebrow: formatCollectionEyebrow(collection.sortOrder, collectionLabel),
    summary: copy.description,
    seoTitle: copy.seoTitle,
    seoDescription: copy.seoDescription,
    heroImage: storefrontMedia(collection.heroImageUrl, collection.slug),
    accent: collection.code ?? "",
    manifesto: copy.manifesto,
    storyTitle: copy.storyTitle,
    storyBody: copy.storyBody,
    symbolismLabel: copy.symbolismLabel,
    symbolismTitle: copy.symbolismTitle,
    symbolismBody: copy.symbolismBody,
    symbolismBody2: copy.symbolismBody2,
    /** Locale-only; empty does not inherit EN — page falls back to detailShopLabel / messages. */
    ctaLabel: resolveCollectionCtaLabel(collection, locale),
    updatedAt: collection.updatedAt,
  };
}

async function resolveCollectionEyebrowLabel(locale: Locale): Promise<string> {
  // Prefer Shared / обменка override when present; else shipped messages.
  const { getStorefrontCopy } = await import("@/lib/content/storefront-copy");
  const copy = await getStorefrontCopy();
  const override = copy[locale]?.["home.archive.collection"]?.trim();
  return override || shippedCollectionEyebrowLabel(locale);
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
      ...buildShopProductWhere(filters, locale),
      ...(options.shopifyProductIds ? { shopifyProductId: { in: options.shopifyProductIds } } : {}),
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

  const taxonomyOverlays = await getTaxonomyFacetLabelMap(locale);
  const localizedProducts = orderedProducts
    .map((product) => toSummary(product, locale, taxonomyOverlays))
    .filter((product) => product.image);

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

  const taxonomyOverlays = await getTaxonomyFacetLabelMap(locale);
  return toSummary(product, locale, taxonomyOverlays);
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
  const source = {
    title: page.title,
    excerpt: page.excerpt,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    content: content as Record<string, unknown>,
  };
  const legacyTranslation = (content.translations as Record<string, Record<string, unknown>> | undefined)?.[locale];
  const resolved = resolvePageLocalizedCopy({
    locale,
    source,
    translation: normalizedTranslation,
    legacyTranslation,
    pageSlug: page.slug,
  });
  const owned = ownedLocalizedPageFields({
    locale,
    source,
    translation: normalizedTranslation,
    legacyTranslation,
  });

  return {
    slug: resolveLocalizedHandle(locale, page.slug, normalizedTranslation?.localizedHandle),
    sourceSlug: page.slug,
    title: resolved.title,
    excerpt: resolved.excerpt,
    seoTitle: resolved.seoTitle,
    seoDescription: resolved.seoDescription,
    ownedEyebrow: owned.eyebrow,
    ownedExcerpt: owned.excerpt,
    content: normalizeCustomerCareContent(resolved.content) as PageContent,
  };
}

export async function getAdminCatalogData() {
  const [rawPages, rawProducts, categoryRows, tags, collections, issues] = await Promise.all([
    db.page.findMany({
      where: { slug: { notIn: [...RETIRED_PAGE_SLUGS] } },
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

  const pages = rawPages.map((page) => ({
    ...page,
    content: normalizeCustomerCareContent(page.content),
    translations: page.translations.map((translation) => ({
      ...translation,
      content: normalizeCustomerCareContent(translation.content),
    })),
  }));

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
