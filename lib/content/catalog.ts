import { db } from "@/lib/db";
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
import { characteristicDisplayValue, type ProductCharacteristicValue } from "@/lib/products/characteristics";
import { storefrontMedia } from "@/lib/content/media-fallbacks";

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
  sku: string;
  series: string;
  title: string;
  shortDescription: string;
  description: string;
  price: string;
  compareAtPrice: string;
  stockOnHand: number;
  variantCount: number;
  vendor: string;
  shopifyCategoryName: string;
  commerceMedia: Array<{ src: string; alt: string; width: number | null; height: number | null }>;
  options: Array<{ name: string; values: string[] }>;
  variantDetails: Array<{
    title: string;
    sku: string;
    barcode: string;
    price: string;
    compareAtPrice: string;
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
};

export type ShopFilters = {
  q?: string;
  department?: string;
  category?: string;
  tag?: string;
  collection?: string;
  material?: string;
  finish?: string;
  origin?: string;
  certified?: string;
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

function priceFromCents(priceCents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(priceCents / 100);
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
  vendor: string | null;
  shopifyCategoryName: string | null;
  shopifySnapshot: unknown;
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
  characteristics: Array<{
    key: string; label: string; group: string; valueType: "TEXT" | "NUMBER" | "BOOLEAN";
    textValue: string | null; numberValue: { toString(): string } | null; booleanValue: boolean | null;
    unit: string | null; certificateUrl: string | null; sortOrder: number;
  }>;
  variants: Array<{
    title: string;
    sku: string;
    barcode: string | null;
    stockOnHand: number;
    priceCents: number;
    compareAtCents: number | null;
    weightGrams: { toString(): string } | null;
    selectedOptions: unknown;
  }>;
}): ProductSummary {
  const leadCollection = product.collections[0]?.collection;
  const details = parseProductDetails(product.details);
  const process = {
    eyebrow: details.process?.eyebrow ?? "",
    title: details.process?.title ?? "",
    mediaImage: details.process?.mediaImage ?? "",
    stats: details.process?.stats ?? [],
  };
  const primaryVariant = product.variants[0];
  const stockOnHand = product.variants.reduce((total, variant) => total + variant.stockOnHand, 0);
  const compareAtCents = primaryVariant?.compareAtCents ?? null;
  const projection = shopifyProjection(product.shopifySnapshot);

  return {
    slug: product.slug,
    sku: primaryVariant?.sku ?? product.sku,
    series: product.seriesLabel ?? "",
    title: product.name,
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    price: priceFromCents(product.priceCents, product.currency),
    compareAtPrice: compareAtCents == null ? "" : priceFromCents(compareAtCents, product.currency),
    stockOnHand,
    variantCount: product.variants.length,
    vendor: product.vendor ?? "",
    shopifyCategoryName: product.shopifyCategoryName ?? "",
    commerceMedia: projection.media,
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
        title: variant.title,
        sku: variant.sku,
        barcode: variant.barcode ?? "",
        price: priceFromCents(variant.priceCents, product.currency),
        compareAtPrice: variant.compareAtCents == null ? "" : priceFromCents(variant.compareAtCents, product.currency),
        stockOnHand: variant.stockOnHand,
        weightGrams: variant.weightGrams == null ? null : Number(variant.weightGrams),
        selectedOptions,
      };
    }),
    image: storefrontMedia(product.imageUrl, product.slug),
    collectionSlug: leadCollection?.slug ?? "",
    collectionName: leadCollection?.name ?? "",
    materialLine: product.materialLine ?? "",
    departmentSlug: details.department ?? null,
    departmentName: shopDepartmentName(details.department),
    attributes: product.characteristics.length
      ? product.characteristics.map((item) => ({ label: item.label, value: characteristicDisplayValue({ ...item, numberValue: item.numberValue == null ? null : Number(item.numberValue) }) }))
      : details.attributes ?? [],
    characteristics: product.characteristics.map((item) => ({ ...item, numberValue: item.numberValue == null ? null : Number(item.numberValue) })),
    categorySlug: product.category?.slug ?? null,
    categoryName: product.category?.name ?? null,
    tagSlugs: product.tags.map((item) => item.tag.slug),
    tagNames: product.tags.map((item) => item.tag.name),
    symbolismLabel: product.symbolismLabel ?? leadCollection?.symbolismLabel ?? "",
    symbolismTitle: product.symbolismTitle ?? leadCollection?.symbolismTitle ?? "",
    symbolismBody: product.symbolismBody ?? leadCollection?.symbolismBody ?? "",
    symbolismBody2: product.symbolismBody2 ?? leadCollection?.symbolismBody2 ?? "",
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
  const [categories, tags, collections, characteristicRows] = await Promise.all([
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
    db.productCharacteristic.findMany({
      where: { filterable: true, textValue: { not: null }, product: { status: "ACTIVE", visibility: "PUBLIC" } },
      select: { key: true, textValue: true },
      distinct: ["key", "textValue"],
      orderBy: { textValue: "asc" },
    }),
  ]);

  const values = (key: string) => characteristicRows.filter((item) => item.key === key && item.textValue).map((item) => ({ slug: item.textValue!, name: item.textValue! }));
  return { departments: SHOP_DEPARTMENTS, categories, tags, collections, materials: values("material"), finishes: values("finish"), origins: values("origin") };
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
  };
}

function formatCollectionEyebrow(sortOrder: number | null | undefined) {
  if (!Number.isFinite(sortOrder) || (sortOrder ?? 0) <= 0) {
    return "Collection";
  }

  return `Collection ${String(sortOrder).padStart(2, "0")}`;
}

export async function listShopProducts(filters: ShopFilters = {}) {
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
      ...(filters.material ? { characteristics: { some: { key: "material", textValue: filters.material } } } : {}),
      ...(filters.finish ? { characteristics: { some: { key: "finish", textValue: filters.finish } } } : {}),
      ...(filters.origin ? { characteristics: { some: { key: "origin", textValue: filters.origin } } } : {}),
      ...(filters.certified ? { characteristics: { some: { key: filters.certified, booleanValue: true } } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { seriesLabel: { contains: q, mode: "insensitive" } },
              { shortDescription: { contains: q, mode: "insensitive" } },
              { materialLine: { contains: q, mode: "insensitive" } },
              { searchSummary: { contains: q, mode: "insensitive" } },
              { searchDocument: { contains: q, mode: "insensitive" } },
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
      characteristics: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
      variants: { orderBy: { createdAt: "asc" } },
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
      characteristics: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
      variants: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!product || product.status !== "ACTIVE" || product.visibility !== "PUBLIC") {
    return null;
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
  const [pages, rawProducts, categories, tags, collections, issues] = await Promise.all([
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
        characteristics: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
        variants: { orderBy: { createdAt: "asc" } },
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

  const products = rawProducts.map((product) => ({
    ...product,
    characteristics: product.characteristics.map((item) => ({
      ...item,
      numberValue: item.numberValue == null ? null : Number(item.numberValue),
    })),
    variants: product.variants.map((variant) => ({
      ...variant,
      weightGrams: variant.weightGrams == null ? null : Number(variant.weightGrams),
    })),
  }));
  return { pages, products, categories, tags, collections, issues };
}
