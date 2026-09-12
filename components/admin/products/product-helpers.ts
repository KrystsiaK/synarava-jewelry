import { parseProductDetails } from "@/lib/content/product-details";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import type { ProductDraft, ProductRecord, ProductRowAction } from "@/components/admin/products/product-types";

export const PRODUCT_SAVE_FAILURE_MESSAGE =
  "Product could not be saved. Reload this page before trying again.";

export function centsToPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

export function getProductEditorDetails(details: unknown, characteristics: ProductRecord["characteristics"] = [], department = "") {
  const parsed = parseProductDetails(details);
  const attributes = Array.from({ length: 8 }, (_, index) => {
    const source = parsed.attributes?.[index];
    return { label: source?.label ?? "", value: source?.value ?? "" };
  });

  const materialsEyebrow = parsed.materialsEyebrow ?? "";
  const materialsTitle = parsed.materialsTitle ?? "";
  const materials = Array.from({ length: 3 }, (_, index) => {
    const source = parsed.materials?.[index];
    return {
      title: source?.title ?? "",
      body: source?.body ?? "",
      image: source?.image ?? "",
    };
  });

  const process = {
    eyebrow: parsed.process?.eyebrow ?? "",
    title: parsed.process?.title ?? "",
    mediaImage: parsed.process?.mediaImage ?? "",
    stats: Array.from({ length: 4 }, (_, index) => {
      const source = parsed.process?.stats?.[index];
      return { value: source?.value ?? "", label: source?.label ?? "" };
    }),
  };

  const lookbookEyebrow = parsed.lookbookEyebrow ?? "";
  const lookbookTitle = parsed.lookbookTitle ?? "";
  const lookbook = Array.from({ length: 4 }, (_, index) => {
    const source = parsed.lookbook?.[index];
    return {
      src: source?.src ?? "",
      label: source?.label ?? "",
      featured: Boolean(source?.featured),
    };
  });

  return {
    department,
    attributes,
    characteristics: Object.fromEntries(characteristics.map((item) => [item.key, {
      value: item.valueType === "BOOLEAN"
        ? Boolean(item.booleanValue)
        : item.valueType === "NUMBER"
          ? item.numberValue?.toString() ?? ""
          : item.textValue ?? "",
      certificateUrl: item.certificateUrl ?? "",
    }])),
    materialsEyebrow,
    materialsTitle,
    materials,
    process,
    lookbookEyebrow,
    lookbookTitle,
    lookbook,
  };
}

export function emptyDraft(): ProductDraft {
  return {
    name: "", slug: "", sku: "", price: "", seriesLabel: "",
    shortDescription: "", description: "", seoTitle: "", seoDescription: "", materialLine: "",
    symbolismLabel: "", symbolismTitle: "", symbolismBody: "",
    symbolismBody2: "", shopifyCategoryId: "", shopifyCategoryName: "", collectionSlug: "",
    tags: "", workflowState: "DRAFT", imageUrl: "", stockOnHand: "0",
    pt: {
      title: "", shortDescription: "", description: "", materialLine: "",
      symbolismLabel: "", symbolismTitle: "", symbolismBody: "", symbolismBody2: "",
      seoTitle: "", seoDescription: "",
      reviewed: false, syncStatus: "NOT_APPLICABLE", syncError: "",
    },
  };
}

export function productToDraft(product: ProductRecord): ProductDraft {
  // Commerce fields are owned by the variant, not Product's own mirror
  // columns (kept only as a Shopify pull identity anchor). Collection
  // membership mixes marketing collections with the primary-nav
  // ("department") one in the same array — exclude isPrimaryNav here too.
  const primaryVariant = product.variants[0];
  const marketingCollection = product.collections.find((item) => !item.collection.isPrimaryNav)?.collection;
  const pt = product.translations?.find((translation) => translation.locale === "PT");
  return {
    name: product.name,
    slug: product.slug,
    sku: primaryVariant?.sku ?? product.sku,
    price: centsToPrice(primaryVariant?.priceCents ?? product.priceCents),
    seriesLabel: product.seriesLabel ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    materialLine: product.materialLine ?? "",
    symbolismLabel: product.symbolismLabel ?? "",
    symbolismTitle: product.symbolismTitle ?? "",
    symbolismBody: product.symbolismBody ?? "",
    symbolismBody2: product.symbolismBody2 ?? "",
    shopifyCategoryId: product.shopifyCategoryId ?? "",
    shopifyCategoryName: product.shopifyCategoryName ?? "",
    collectionSlug: marketingCollection?.slug ?? "",
    tags: product.tags.map((item) => item.tag.slug).join(", "),
    workflowState: product.status === "ACTIVE" && product.visibility === "PUBLIC"
      ? "PUBLISHED"
      : product.status === "UNLISTED" && product.visibility === "UNLISTED"
        ? "UNLISTED"
        : "DRAFT",
    imageUrl: product.imageUrl ?? "",
    stockOnHand: String(primaryVariant?.stockOnHand ?? 0),
    pt: {
      title: pt?.title ?? "",
      shortDescription: pt?.shortDescription ?? "",
      description: pt?.description ?? "",
      materialLine: pt?.materialLine ?? "",
      symbolismLabel: pt?.symbolismLabel ?? "",
      symbolismTitle: pt?.symbolismTitle ?? "",
      symbolismBody: pt?.symbolismBody ?? "",
      symbolismBody2: pt?.symbolismBody2 ?? "",
      seoTitle: pt?.seoTitle ?? "",
      seoDescription: pt?.seoDescription ?? "",
      reviewed: pt?.reviewStatus === "REVIEWED",
      syncStatus: pt?.syncStatus ?? "NOT_APPLICABLE",
      syncError: pt?.syncError ?? "",
    },
  };
}

export function normalizeProducts(items: ProductRecord[]) {
  return [...items].sort((left, right) => right.name.localeCompare(left.name));
}

export const PRODUCT_SORT_OPTIONS = [
  { value: "published", label: "Latest published" },
  { value: "updated", label: "Recently updated" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "price-desc", label: "Price (high–low)" },
  { value: "price-asc", label: "Price (low–high)" },
] as const;

export type ProductSortKey = (typeof PRODUCT_SORT_OPTIONS)[number]["value"];

export function sortProducts(items: ProductRecord[], sortBy: ProductSortKey) {
  const sorted = [...items];
  switch (sortBy) {
    case "published":
      return sorted.sort((left, right) => {
        const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : -Infinity;
        const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : -Infinity;
        return rightTime - leftTime;
      });
    case "updated":
      return sorted.sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );
    case "name-asc":
      return sorted.sort((left, right) => left.name.localeCompare(right.name));
    case "name-desc":
      return sorted.sort((left, right) => right.name.localeCompare(left.name));
    case "price-asc":
      return sorted.sort((left, right) => left.priceCents - right.priceCents);
    case "price-desc":
      return sorted.sort((left, right) => right.priceCents - left.priceCents);
  }
}

export function productStatusLabel(product: ProductRecord) {
  if (product.status === "ARCHIVED") return "ARCHIVED";
  if (product.status === "UNLISTED") return "UNLISTED";
  return product.status === "ACTIVE" && product.visibility === "PUBLIC" ? "PUBLISHED" : "DRAFT";
}

export function issuesForField(issues: AdminIssueSummary[], fieldPath: string) {
  return issues.filter((issue) => issue.fieldPath === fieldPath && issue.status === "OPEN");
}

export function productActionCopy(target: ProductRowAction) {
  const name = target.product.name;
  if (target.action === "publish") {
    return {
      title: `Publish ${name}`,
      description:
        "This will make the product visible on the storefront and product listings. Customers may be able to view and add it to cart immediately.",
      confirmLabel: "Publish product",
      tone: "default" as const,
    };
  }
  if (target.action === "draft") {
    return {
      title: `Move ${name} to draft`,
      description:
        "This will remove the product from public listings and direct public product pages. Existing order history remains unchanged.",
      confirmLabel: "Move to draft",
      tone: "default" as const,
    };
  }
  if (target.action === "archive") {
    return {
      title: `Archive ${name}`,
      description:
        "This will hide the product from the storefront and keep the record in admin for later recovery. Use this instead of permanent delete when you may need history or content back.",
      confirmLabel: "Archive product",
      tone: "danger" as const,
    };
  }
  return {
    title: `Permanently delete ${name}`,
    description:
      "This permanently removes the product record and related product media, variants, tags, and collection links. Public product URLs will stop working. Prefer Archive unless you are certain.",
    confirmLabel: "Delete permanently",
    tone: "danger" as const,
  };
}
