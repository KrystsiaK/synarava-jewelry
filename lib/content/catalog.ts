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

export type ProductAttribute = {
  label: string;
  value: string;
};

export type ProductMaterialStory = {
  title: string;
  body: string;
  image: string;
};

export type ProductProcessStat = {
  value: string;
  label: string;
};

export type ProductProcessStory = {
  eyebrow: string;
  title: string;
  mediaImage: string;
  stats: ProductProcessStat[];
};

export type ProductLookbookStory = {
  src: string;
  label: string;
  featured?: boolean;
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

export type ProductDetailsPayload = {
  department?: ShopDepartmentSlug;
  attributes?: ProductAttribute[];
  materialsEyebrow?: string;
  materialsTitle?: string;
  materials?: ProductMaterialStory[];
  process?: Partial<ProductProcessStory> & { stats?: ProductProcessStat[] };
  lookbookEyebrow?: string;
  lookbookTitle?: string;
  lookbook?: ProductLookbookStory[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLegacyDemoImage(value: string) {
  return value.startsWith("https://lh3.googleusercontent.com/aida");
}

function storefrontImage(value: string | null | undefined) {
  const image = value?.trim() ?? "";
  return image && !isLegacyDemoImage(image) ? image : "";
}

function normalizeMaterialStory(value: unknown): ProductMaterialStory | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";
  const image = typeof value.image === "string" ? value.image.trim() : "";
  if (!title || !body || !image || isLegacyDemoImage(image)) return null;
  return { title, body, image };
}

function normalizeLookbookStory(value: unknown): ProductLookbookStory | null {
  if (!isRecord(value)) return null;
  const src = typeof value.src === "string" ? value.src.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const featured = Boolean(value.featured);
  if (!src || isLegacyDemoImage(src)) return null;
  return { src, label, featured };
}

function normalizeProcessStat(value: unknown): ProductProcessStat | null {
  if (!isRecord(value)) return null;
  const valueText = typeof value.value === "string" ? value.value.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  if (!valueText || !label) return null;
  return { value: valueText, label };
}

function normalizeProductAttribute(value: unknown): ProductAttribute | null {
  if (!isRecord(value)) return null;
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const attributeValue = typeof value.value === "string" ? value.value.trim() : "";
  if (!label || !attributeValue) return null;
  return { label, value: attributeValue };
}

export function parseProductDetails(details: unknown): ProductDetailsPayload {
  if (!isRecord(details)) {
    return {};
  }

  const materialsEyebrow =
    typeof details.materialsEyebrow === "string" ? details.materialsEyebrow.trim() : "";
  const materialsTitle =
    typeof details.materialsTitle === "string" ? details.materialsTitle.trim() : "";
  const department = isShopDepartmentSlug(details.department) ? details.department : undefined;
  const attributes = Array.isArray(details.attributes)
    ? details.attributes.map(normalizeProductAttribute).filter(Boolean) as ProductAttribute[]
    : [];
  const materials = Array.isArray(details.materials)
    ? details.materials.map(normalizeMaterialStory).filter(Boolean) as ProductMaterialStory[]
    : [];

  const lookbookEyebrow =
    typeof details.lookbookEyebrow === "string" ? details.lookbookEyebrow.trim() : "";
  const lookbookTitle =
    typeof details.lookbookTitle === "string" ? details.lookbookTitle.trim() : "";
  const lookbook = Array.isArray(details.lookbook)
    ? details.lookbook.map(normalizeLookbookStory).filter(Boolean) as ProductLookbookStory[]
    : [];

  const rawProcess = isRecord(details.process) ? details.process : null;
  const rawProcessMedia =
    rawProcess && typeof rawProcess.mediaImage === "string"
      ? rawProcess.mediaImage.trim()
      : "";
  const process = rawProcess && !isLegacyDemoImage(rawProcessMedia)
    ? {
        eyebrow: typeof rawProcess.eyebrow === "string" ? rawProcess.eyebrow.trim() : undefined,
        title: typeof rawProcess.title === "string" ? rawProcess.title.trim() : undefined,
        mediaImage: rawProcessMedia || undefined,
        stats: Array.isArray(rawProcess.stats)
          ? rawProcess.stats.map(normalizeProcessStat).filter(Boolean) as ProductProcessStat[]
          : undefined,
      }
    : undefined;

  return {
    department,
    attributes,
    materialsEyebrow,
    materialsTitle,
    materials,
    process,
    lookbookEyebrow,
    lookbookTitle,
    lookbook,
  };
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
