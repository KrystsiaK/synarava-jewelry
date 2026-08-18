import "server-only";

import type { ProductSummary } from "@/lib/content/catalog";
import type { ShopFilters } from "@/components/shop/types";
import {
  isShopDepartmentSlug,
  shopDepartmentName,
  type ShopDepartmentSlug,
} from "@/lib/catalog/taxonomy";
import { shopifyStorefrontRequest } from "@/lib/shopify/storefront";

type ShopifyProduct = {
  handle: string;
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
      availableForSale: boolean;
      selectedOptions: Array<{ name: string; value: string }>;
    }>;
  };
};

type ShopifyProductConnection = {
  products: { nodes: ShopifyProduct[] };
};

function formatMoney(amount: string, currency: string) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number.parseFloat(amount));
}

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

function toProductSummary(product: ShopifyProduct): ProductSummary {
  const department = inferDepartment(product);
  const leadCollection = product.collections.nodes[0];
  const firstAvailableVariant = product.variants.nodes.find((variant) => variant.availableForSale);
  const attributes = (firstAvailableVariant?.selectedOptions ?? [])
    .filter((option) => option.value !== "Default Title")
    .map((option) => ({ label: option.name, value: option.value }));

  return {
    slug: product.handle,
    series: product.vendor === "Synarava" ? "" : product.vendor,
    title: product.title,
    shortDescription: product.description,
    price: formatMoney(
      product.priceRange.minVariantPrice.amount,
      product.priceRange.minVariantPrice.currencyCode,
    ),
    image: product.featuredImage?.url ?? "",
    collectionSlug: leadCollection?.handle ?? "",
    collectionName: leadCollection?.title ?? "",
    materialLine: "",
    departmentSlug: department,
    departmentName: shopDepartmentName(department),
    attributes,
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
  };
}

const PRODUCT_FIELDS = `#graphql
  fragment SynaravaStorefrontProductFields on Product {
    handle
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
        availableForSale
        selectedOptions { name value }
      }
    }
  }
`;

export async function getShopifyProductByHandle(handle: string): Promise<ProductSummary | null> {
  const data = await shopifyStorefrontRequest<{ product: ShopifyProduct | null }>(
    `#graphql
      ${PRODUCT_FIELDS}
      query SynaravaStorefrontProduct($handle: String!) {
        product(handle: $handle) {
          ...SynaravaStorefrontProductFields
        }
      }
    `,
    { handle },
  );

  const product = data.product;
  if (!product) return null;

  return toProductSummary(product);
}

async function loadShopifyProducts() {
  const data = await shopifyStorefrontRequest<ShopifyProductConnection>(
    `#graphql
      ${PRODUCT_FIELDS}
      query SynaravaStorefrontProducts {
        products(first: 100, sortKey: CREATED_AT, reverse: true) {
          nodes { ...SynaravaStorefrontProductFields }
        }
      }
    `,
  );

  return data.products.nodes;
}

export async function listShopifyProducts(filters: ShopFilters = {}) {
  const products = (await loadShopifyProducts()).map(toProductSummary).filter((product) => product.image);
  const query = filters.q?.trim().toLowerCase();

  return products.filter((product) => {
    if (filters.department && product.departmentSlug !== filters.department) return false;
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
  const products = (await loadShopifyProducts()).map(toProductSummary);
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
