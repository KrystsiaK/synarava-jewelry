import { db } from "@/lib/db";
import { isShopifyCommerceEnabled } from "@/lib/shopify/config";
import {
  getShopifyProductByHandle,
  getShopifyProductFilters,
  listShopifyProducts,
} from "@/lib/shopify/products";
import {
  SHOP_DEPARTMENTS,
  isShopDepartmentSlug,
  shopDepartmentName,
  type ShopDepartmentSlug,
} from "@/lib/catalog/taxonomy";
import {
  parseProductDetails,
  type ProductAttribute,
  type ProductLookbookStory,
  type ProductMaterialStory,
  type ProductProcessStory,
} from "@/lib/content/product-details";

export type CollectionSummary = {
  slug: string;
  name: string;
  eyebrow: string;
  summary: string;
  heroImage: string;
  accent: string;
};

export type ProductSummary = {
  slug: string;
  series: string;
  title: string;
  shortDescription: string;
  price: string;
  image: string;
  collectionSlug: string;
  collectionName: string;
  materialLine: string;
  departmentSlug: ShopDepartmentSlug | null;
  departmentName: string;
  attributes: ProductAttribute[];
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
};

export type ShopFilters = {
  q?: string;
  department?: string;
  category?: string;
  tag?: string;
  collection?: string;
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
};

function isLegacyDemoImage(value: string) {
  return value.startsWith("https://lh3.googleusercontent.com/aida");
}

function storefrontImage(value: string | null | undefined) {
  const image = value?.trim() ?? "";
  return image && !isLegacyDemoImage(image) ? image : "";
}

function priceFromCents(priceCents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(priceCents / 100);
}

function toSummary(product: {
  slug: string;
  name: string;
  seriesLabel: string | null;
  shortDescription: string | null;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  materialLine: string | null;
  symbolismLabel: string | null;
  symbolismTitle: string | null;
  symbolismBody: string | null;
  symbolismBody2: string | null;
  details: unknown;
  category: { slug: string; name: string } | null;
  tags: { tag: { slug: string; name: string } }[];
  collections: {
    collection: {
      slug: string;
      name: string;
      symbolismLabel: string | null;
      symbolismTitle: string | null;
      symbolismBody: string | null;
      symbolismBody2: string | null;
    };
  }[];
}): ProductSummary {
  const leadCollection = product.collections[0]?.collection;
  const details = parseProductDetails(product.details);
  const process = {
    eyebrow: details.process?.eyebrow ?? "",
    title: details.process?.title ?? "",
    mediaImage: details.process?.mediaImage ?? "",
    stats: details.process?.stats ?? [],
  };

  return {
    slug: product.slug,
    series: product.seriesLabel ?? "",
    title: product.name,
    shortDescription: product.shortDescription ?? "",
    price: priceFromCents(product.priceCents, product.currency),
    image: storefrontImage(product.imageUrl),
    collectionSlug: leadCollection?.slug ?? "",
    collectionName: leadCollection?.name ?? "",
    materialLine: product.materialLine ?? "",
    departmentSlug: details.department ?? null,
    departmentName: shopDepartmentName(details.department),
    attributes: details.attributes ?? [],
    categorySlug: product.category?.slug ?? null,
    categoryName: product.category?.name ?? null,
    tagSlugs: product.tags.map((item) => item.tag.slug),
    tagNames: product.tags.map((item) => item.tag.name),
    symbolismLabel: product.symbolismLabel ?? "",
    symbolismTitle: product.symbolismTitle ?? "",
    symbolismBody: product.symbolismBody ?? "",
    symbolismBody2: product.symbolismBody2 ?? "",
    materialsEyebrow: details.materialsEyebrow ?? "",
    materialsTitle: details.materialsTitle ?? "",
    materials: details.materials ?? [],
    process,
    lookbookEyebrow: details.lookbookEyebrow ?? "",
    lookbookTitle: details.lookbookTitle ?? "",
    lookbook: details.lookbook ?? [],
  };
}

export async function getShopFilterData() {
  if (isShopifyCommerceEnabled()) {
    const filters = await getShopifyProductFilters();
    return { departments: SHOP_DEPARTMENTS, ...filters };
  }

  const [categories, tags, collections] = await Promise.all([
    db.productCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.tag.findMany({
      orderBy: { name: "asc" },
    }),
    db.collection.findMany({
      where: { status: "ACTIVE", visibility: "PUBLIC" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return { departments: SHOP_DEPARTMENTS, categories, tags, collections };
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
    heroImage: storefrontImage(collection.heroImageUrl),
    accent: collection.code ?? "",
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
    heroImage: storefrontImage(collection.heroImageUrl),
    accent: collection.code ?? "",
    manifesto: collection.manifesto ?? "",
    symbolismLabel: collection.symbolismLabel ?? "",
    symbolismTitle: collection.symbolismTitle ?? "",
    symbolismBody: collection.symbolismBody ?? "",
    symbolismBody2: collection.symbolismBody2 ?? "",
  };
}

function formatCollectionEyebrow(sortOrder: number | null | undefined) {
  if (!Number.isFinite(sortOrder) || (sortOrder ?? 0) <= 0) {
    return "Collection";
  }

  return `Collection ${String(sortOrder).padStart(2, "0")}`;
}

export async function listShopProducts(filters: ShopFilters = {}) {
  if (isShopifyCommerceEnabled()) {
    return listShopifyProducts(filters);
  }

  const q = filters.q?.trim();

  const products = await db.product.findMany({
    where: {
      status: "ACTIVE",
      visibility: "PUBLIC",
      ...(filters.department && isShopDepartmentSlug(filters.department)
        ? {
            details: {
              path: ["department"],
              equals: filters.department,
            },
          }
        : {}),
      ...(filters.category
        ? {
            category: {
              slug: filters.category,
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
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { seriesLabel: { contains: q, mode: "insensitive" } },
              { shortDescription: { contains: q, mode: "insensitive" } },
              { materialLine: { contains: q, mode: "insensitive" } },
              { searchSummary: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: true,
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
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return products.map(toSummary).filter((product) => product.image);
}

export async function getProductBySlug(slug: string) {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      category: true,
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
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!product || product.status !== "ACTIVE" || product.visibility !== "PUBLIC") {
    return isShopifyCommerceEnabled() ? getShopifyProductByHandle(slug) : null;
  }

  return toSummary(product);
}

export async function getProductsByCollection(slug: string) {
  return listShopProducts({ collection: slug });
}

export async function getPageBySlug(slug: string) {
  const page = await db.page.findUnique({
    where: { slug },
  });

  if (!page || page.status !== "PUBLISHED" || page.visibility !== "PUBLIC") {
    return null;
  }

  return {
    slug: page.slug,
    title: page.title,
    excerpt: page.excerpt ?? "",
    content: (page.content ?? {}) as PageContent,
  };
}

export async function getAdminCatalogData() {
  const [pages, products, categories, tags, collections, issues] = await Promise.all([
    db.page.findMany({
      orderBy: { slug: "asc" },
    }),
    db.product.findMany({
      include: {
        category: true,
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
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.productCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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

  return { pages, products, categories, tags, collections, issues };
}
