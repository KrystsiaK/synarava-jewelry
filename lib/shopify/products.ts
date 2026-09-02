import "server-only";

import type { ProductSummary } from "@/lib/content/catalog";
import type { ShopFilters } from "@/components/shop/types";
import {
  isShopDepartmentSlug,
  shopDepartmentName,
  type ShopDepartmentSlug,
} from "@/lib/catalog/taxonomy";
import { shopifyStorefrontRequest } from "@/lib/shopify/storefront";
import { formatCurrency, shopifyLanguage } from "@/lib/i18n/format";
import { getRequestLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locales";

type ShopifyProduct = {
  id: string;
  handle: string;
  updatedAt: string;
  title: string;
  description: string;
  productType: string;
  vendor: string;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  collections: { nodes: Array<{ handle: string; title: string }> };
  variants: {
    nodes: Array<{
      id: string;
      availableForSale: boolean;
      sku: string | null;
      price: { amount: string; currencyCode: string };
      compareAtPrice: { amount: string; currencyCode: string } | null;
      selectedOptions: Array<{ name: string; value: string }>;
    }>;
  };
};

type ShopifyProductConnection = {
  products: { nodes: ShopifyProduct[] };
};

function inferDepartment(product: ShopifyProduct): ShopDepartmentSlug {
  const explicitType = product.productType.trim().toLowerCase();
  if (isShopDepartmentSlug(explicitType)) return explicitType;

  const searchable = `${product.productType} ${product.title}`.toLowerCase();
  if (/\b(leash|lead|collar|harness|pet|dog|cat)\b/.test(searchable)) return "pets";
  if (/\b(kid|kids|child|children|educational toy|developmental toy)\b/.test(searchable)) {
    return "kids";
  }
  if (/\b(bead|finding|cord|chain|jewelry making|jewellery making|craft tool|supply)\b/.test(searchable)) {
    return "jewelry-making";
  }
  return "jewelry";
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toProductSummary(product: ShopifyProduct, locale: Locale): ProductSummary {
  const department = inferDepartment(product);
  const leadCollection = product.collections.nodes[0];
  const firstAvailableVariant = product.variants.nodes.find((variant) => variant.availableForSale);
  const primaryVariant = firstAvailableVariant ?? product.variants.nodes[0];
  const priceAmount = Number.parseFloat(product.priceRange.minVariantPrice.amount);
  const attributes = (firstAvailableVariant?.selectedOptions ?? [])
    .filter((option) => option.value !== "Default Title")
    .map((option) => ({ label: option.name, value: option.value }));

  return {
    slug: product.handle,
    sku: primaryVariant?.sku ?? "",
    series: product.vendor === "Synarava" ? "" : product.vendor,
    title: product.title,
    shortDescription: product.description,
    description: product.description,
    price: formatCurrency(Number.parseFloat(product.priceRange.minVariantPrice.amount), product.priceRange.minVariantPrice.currencyCode, locale),
    priceAmount,
    currency: product.priceRange.minVariantPrice.currencyCode,
    compareAtPrice: "",
    compareAtAmount: null,
    stockOnHand: product.variants.nodes.some((variant) => variant.availableForSale) ? 1 : 0,
    variantCount: product.variants.nodes.length,
    vendor: product.vendor,
    shopifyCategoryName: product.productType,
    commerceMedia: product.featuredImage ? [{
      src: product.featuredImage.url,
      alt: product.featuredImage.altText ?? product.title,
      width: null,
      height: null,
    }] : [],
    options: [],
    variantDetails: product.variants.nodes.map((variant) => ({
      merchandiseId: variant.id,
      title: variant.selectedOptions.map((option) => option.value).join(" / ") || "Default",
      sku: variant.sku ?? "",
      barcode: "",
      price: formatCurrency(Number.parseFloat(variant.price.amount), variant.price.currencyCode, locale),
      priceAmount: Number.parseFloat(variant.price.amount),
      compareAtPrice: variant.compareAtPrice
        ? formatCurrency(Number.parseFloat(variant.compareAtPrice.amount), variant.compareAtPrice.currencyCode, locale)
        : "",
      compareAtAmount: variant.compareAtPrice ? Number.parseFloat(variant.compareAtPrice.amount) : null,
      stockOnHand: variant.availableForSale ? 1 : 0,
      weightGrams: null,
      selectedOptions: variant.selectedOptions,
    })),
    image: product.featuredImage?.url ?? "",
    collectionSlug: leadCollection?.handle ?? "",
    collectionName: leadCollection?.title ?? "",
    materialLine: "",
    departmentSlug: department,
    departmentName: shopDepartmentName(department),
    attributes,
    characteristics: [],
    categorySlug: product.productType ? slugify(product.productType) : null,
    categoryName: product.productType || null,
    tagSlugs: [],
    tagNames: [],
    symbolismLabel: "",
    symbolismTitle: "",
    symbolismBody: "",
    symbolismBody2: "",
    materialsEyebrow: "",
    materialsTitle: "",
    materials: [],
    process: { eyebrow: "", title: "", mediaImage: "", stats: [] },
    lookbookEyebrow: "",
    lookbookTitle: "",
    lookbook: [],
    updatedAt: new Date(product.updatedAt),
  };
}

const PRODUCT_FIELDS = `#graphql
  fragment SynaravaStorefrontProductFields on Product {
    id
    handle
    updatedAt
    title
    description
    productType
    vendor
    featuredImage { url altText }
    priceRange {
      minVariantPrice { amount currencyCode }
    }
    collections(first: 10) {
      nodes { handle title }
    }
    variants(first: 20) {
      nodes {
        id
        availableForSale
        sku
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        selectedOptions { name value }
      }
    }
  }
`;

export async function getShopifyProductByHandle(handle: string): Promise<ProductSummary | null> {
  const locale = await getRequestLocale();
  const language = shopifyLanguage(locale);
  const data = await shopifyStorefrontRequest<{ product: ShopifyProduct | null }>(
    `#graphql
      ${PRODUCT_FIELDS}
      query SynaravaStorefrontProduct($handle: String!, $language: LanguageCode!) @inContext(language: $language) {
        product(handle: $handle) {
          ...SynaravaStorefrontProductFields
        }
      }
    `,
    { handle, language },
  );

  const product = data.product;
  if (!product) return null;

  return toProductSummary(product, locale);
}

async function loadShopifyProducts(locale: Locale) {
  const language = shopifyLanguage(locale);
  const data = await shopifyStorefrontRequest<ShopifyProductConnection>(
    `#graphql
      ${PRODUCT_FIELDS}
      query SynaravaStorefrontProducts($language: LanguageCode!) @inContext(language: $language) {
        products(first: 100, sortKey: CREATED_AT, reverse: true) {
          nodes { ...SynaravaStorefrontProductFields }
        }
      }
    `,
    { language },
  );

  return data.products.nodes;
}

export async function listShopifyProducts(filters: ShopFilters = {}) {
  const locale = await getRequestLocale();
  const products = (await loadShopifyProducts(locale)).map((product) => toProductSummary(product, locale)).filter((product) => product.image);
  const query = filters.q?.trim().toLowerCase();

  return products.filter((product) => {
    if (filters.department && product.departmentSlug !== filters.department) return false;
    if (filters.availability === "in-stock" && product.stockOnHand < 1) return false;
    if (filters.category && product.categorySlug !== filters.category) return false;
    if (filters.collection && product.collectionSlug !== filters.collection) return false;
    if (filters.tag) return false;
    if (
      query &&
      ![product.title, product.shortDescription, product.categoryName, product.departmentName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    return true;
  });
}

export async function getShopifyProductFilters() {
  const locale = await getRequestLocale();
  const products = (await loadShopifyProducts(locale)).map((product) => toProductSummary(product, locale));
  const categoryMap = new Map<string, string>();
  const collectionMap = new Map<string, string>();

  for (const product of products) {
    if (product.categorySlug && product.categoryName) {
      categoryMap.set(product.categorySlug, product.categoryName);
    }
    if (product.collectionSlug && product.collectionName) {
      collectionMap.set(product.collectionSlug, product.collectionName);
    }
  }

  return {
    categories: Array.from(categoryMap, ([slug, name]) => ({ slug, name })),
    collections: Array.from(collectionMap, ([slug, name]) => ({ slug, name })),
    tags: [] as Array<{ slug: string; name: string }>,
  };
}
