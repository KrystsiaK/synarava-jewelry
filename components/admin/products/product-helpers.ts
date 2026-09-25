import { parseProductDetails } from "@/lib/content/product-details";
import { productCollectionPosition } from "@/lib/catalog/collection-order";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import type { ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import type { ProductDraft, ProductLocaleDraft, ProductRecord, ProductRowAction } from "@/components/admin/products/product-types";

export const PRODUCT_SAVE_FAILURE_MESSAGE =
  "Product could not be saved. Reload this page before trying again.";

export function centsToPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

/**
 * The buyer-facing text inside `details` (attributes, materials, process,
 * lookbook) with fixed slot counts — no images/src, those stay shared
 * between locales. Used for both the English editor (via
 * `getProductEditorDetails`, which adds shared image fields back in) and
 * the Portuguese translation editor, which has no images to show at all.
 */
export function getProductDetailsTranslation(details: unknown) {
  const parsed = parseProductDetails(details);
  return {
    attributes: Array.from({ length: 8 }, (_, index) => {
      const source = parsed.attributes?.[index];
      return { label: source?.label ?? "", value: source?.value ?? "" };
    }),
    materialsEyebrow: parsed.materialsEyebrow ?? "",
    materialsTitle: parsed.materialsTitle ?? "",
    materials: Array.from({ length: 3 }, (_, index) => {
      const source = parsed.materials?.[index];
      return { title: source?.title ?? "", body: source?.body ?? "" };
    }),
    process: {
      eyebrow: parsed.process?.eyebrow ?? "",
      title: parsed.process?.title ?? "",
      stats: Array.from({ length: 4 }, (_, index) => {
        const source = parsed.process?.stats?.[index];
        return { value: source?.value ?? "", label: source?.label ?? "" };
      }),
    },
    lookbookEyebrow: parsed.lookbookEyebrow ?? "",
    lookbookTitle: parsed.lookbookTitle ?? "",
    lookbook: Array.from({ length: 4 }, (_, index) => {
      const source = parsed.lookbook?.[index];
      return { label: source?.label ?? "" };
    }),
  };
}

export function getProductEditorDetails(details: unknown, characteristics: ProductRecord["characteristics"] = []) {
  const parsed = parseProductDetails(details);
  const translation = getProductDetailsTranslation(details);

  return {
    attributes: translation.attributes,
    characteristics: Object.fromEntries(characteristics.map((item) => [item.key, {
      value: item.valueType === "BOOLEAN"
        ? Boolean(item.booleanValue)
        : item.valueType === "NUMBER"
          ? item.numberValue?.toString() ?? ""
          : item.textValue ?? "",
      certificateUrl: item.certificateUrl ?? "",
    }])),
    materialsEyebrow: translation.materialsEyebrow,
    materialsTitle: translation.materialsTitle,
    materials: translation.materials.map((material, index) => ({
      ...material,
      image: parsed.materials?.[index]?.image ?? "",
    })),
    process: {
      ...translation.process,
      mediaImage: parsed.process?.mediaImage ?? "",
    },
    lookbookEyebrow: translation.lookbookEyebrow,
    lookbookTitle: translation.lookbookTitle,
    lookbook: translation.lookbook.map((item, index) => ({
      ...item,
      src: parsed.lookbook?.[index]?.src ?? "",
      featured: Boolean(parsed.lookbook?.[index]?.featured),
    })),
  };
}

function emptyLocaleDraft(): ProductLocaleDraft {
  return {
    localizedHandle: "", title: "", shortDescription: "", description: "", materialLine: "",
    symbolismLabel: "", symbolismTitle: "", symbolismBody: "", symbolismBody2: "",
    seoTitle: "", seoDescription: "",
    details: getProductDetailsTranslation(null),
    reviewed: false, syncStatus: "NOT_APPLICABLE", syncError: "",
  };
}

export function emptyDraft(translationLocales: AdminTranslationLocale[] = []): ProductDraft {
  return {
    name: "", vendor: "", productType: "", slug: "", sku: "", price: "", compareAt: "", taxable: true, cost: "", seriesLabel: "",
    shortDescription: "", description: "", seoTitle: "", seoDescription: "", materialLine: "",
    symbolismLabel: "", symbolismTitle: "", symbolismBody: "",
    symbolismBody2: "", shopifyCategoryId: "", shopifyCategoryName: "", collectionSlug: "",
    tags: "", workflowState: "DRAFT", imageUrl: "", stockOnHand: "0",
    translations: Object.fromEntries(translationLocales.map(({ code }) => [code, emptyLocaleDraft()])),
  };
}

export function productToDraft(product: ProductRecord, translationLocales: AdminTranslationLocale[] = []): ProductDraft {
  // Commerce fields are owned by the variant, not Product's own mirror
  // columns (kept only as a Shopify pull identity anchor). Exclude the
  // storefront-default (Featured) membership from the marketing select.
  const primaryVariant = product.variants[0];
  const marketingCollection = product.collections.find(
    (item) => !item.collection.isStorefrontDefault,
  )?.collection;
  return {
    name: product.name,
    vendor: product.vendor ?? "",
    productType: product.productType ?? "",
    slug: product.slug,
    sku: primaryVariant?.sku ?? product.sku,
    price: centsToPrice(primaryVariant?.priceCents ?? product.priceCents),
    compareAt: primaryVariant?.compareAtCents == null ? "" : centsToPrice(primaryVariant.compareAtCents),
    taxable: primaryVariant?.taxable ?? true,
    cost: primaryVariant?.costCents == null ? "" : centsToPrice(primaryVariant.costCents),
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
    translations: Object.fromEntries(translationLocales.map(({ code }) => {
      const translation = product.translations?.find((item) => item.locale === code);
      return [code, {
        localizedHandle: translation?.localizedHandle ?? "",
        title: translation?.title ?? "",
        shortDescription: translation?.shortDescription ?? "",
        description: translation?.description ?? "",
        materialLine: translation?.materialLine ?? "",
        symbolismLabel: translation?.symbolismLabel ?? "",
        symbolismTitle: translation?.symbolismTitle ?? "",
        symbolismBody: translation?.symbolismBody ?? "",
        symbolismBody2: translation?.symbolismBody2 ?? "",
        seoTitle: translation?.seoTitle ?? "",
        seoDescription: translation?.seoDescription ?? "",
        details: getProductDetailsTranslation(translation?.details),
        reviewed: translation?.reviewStatus === "REVIEWED",
        syncStatus: translation?.syncStatus ?? "NOT_APPLICABLE",
        syncError: translation?.syncError ?? "",
      } satisfies ProductLocaleDraft];
    })),
  };
}

export function normalizeProducts(items: ProductRecord[]) {
  return [...items].sort((left, right) => right.name.localeCompare(left.name));
}

export const PRODUCT_SORT_OPTIONS = [
  { value: "collection-priority", label: "Collection priority" },
  { value: "published", label: "Latest published" },
  { value: "updated", label: "Recently updated" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "price-desc", label: "Price (high–low)" },
  { value: "price-asc", label: "Price (low–high)" },
] as const;

export type ProductSortKey = (typeof PRODUCT_SORT_OPTIONS)[number]["value"];

export function sortProducts(items: ProductRecord[], sortBy: ProductSortKey, collectionId?: string) {
  const sorted = [...items];
  switch (sortBy) {
    case "collection-priority":
      return collectionId
        ? sorted.sort((left, right) => (
            productCollectionPosition(left, collectionId) - productCollectionPosition(right, collectionId)
          ))
        : sorted;
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

/** Whether taxonomy fields currently satisfy the QA "missing taxonomy" checks. */
export type TaxonomySatisfaction = {
  hasCategory: boolean;
  hasCollection: boolean;
  hasTags: boolean;
};

export function taxonomySatisfactionFromDraft(
  draft: Pick<ProductDraft, "shopifyCategoryId" | "collectionSlug" | "tags">,
): TaxonomySatisfaction {
  return {
    hasCategory: Boolean(draft.shopifyCategoryId.trim()),
    hasCollection: Boolean(draft.collectionSlug.trim()),
    hasTags: Boolean(draft.tags.trim()),
  };
}

/**
 * Hide sticky QA warnings once the form already has a satisfying value,
 * so selecting a collection/category turns the field green before Save /
 * Scan now. Open AdminIssue rows are still resolved on save/rescan.
 */
export function filterIssuesByTaxonomySatisfaction(
  issues: AdminIssueSummary[],
  satisfaction: TaxonomySatisfaction,
) {
  return openProductIssues(issues).filter((issue) => {
    if (issue.fieldPath === "field-taxonomy-category" && satisfaction.hasCategory) return false;
    if (issue.fieldPath === "field-taxonomy-collection" && satisfaction.hasCollection) return false;
    if (issue.fieldPath === "field-taxonomy-tags" && satisfaction.hasTags) return false;
    return true;
  });
}

/**
 * Maps a scanned issue field id to the product editor section that owns it.
 * Keep in sync with hash routing in `product-edit-form`.
 */
export function productEditorSectionForField(fieldPath: string): ProductEditorSection | null {
  if (fieldPath === "field-imageUrl") return "media";
  if (fieldPath.startsWith("field-taxonomy-")) return "catalog";
  if (fieldPath.startsWith("field-details-")) return "details";
  return null;
}

/**
 * Locale for a language-scoped issue, or `null` when the field is shared
 * across locales (Shopify category, collection, gallery cover, shared media).
 */
export function productEditorLocaleForField(fieldPath: string): string | null {
  // Scanned product issues today are all shared. Reserved for future
  // locale-tagged field paths / metadata (e.g. missing PT title).
  void fieldPath;
  return null;
}

export function openProductIssues(issues: AdminIssueSummary[]) {
  return issues.filter((issue) => issue.status === "OPEN");
}

export function issuesForSection(issues: AdminIssueSummary[], section: ProductEditorSection) {
  return openProductIssues(issues).filter(
    (issue) => productEditorSectionForField(issue.fieldPath) === section,
  );
}

export function sectionsWithOpenIssues(issues: AdminIssueSummary[]) {
  const sections = new Set<ProductEditorSection>();
  for (const issue of openProductIssues(issues)) {
    const section = productEditorSectionForField(issue.fieldPath);
    if (section) sections.add(section);
  }
  return sections;
}

export function localesWithOpenIssues(issues: AdminIssueSummary[]) {
  const locales = new Set<string>();
  for (const issue of openProductIssues(issues)) {
    const locale = productEditorLocaleForField(issue.fieldPath);
    if (locale) locales.add(locale);
  }
  return locales;
}

export function productActionCopy(target: ProductRowAction) {
  const name = target.product.name;
  if (target.action === "publish") {
    return {
      title: `Publish ${name}`,
      description:
        "This will make the product visible on the site and product listings. Customers may be able to view and add it to cart immediately.",
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
        "This will hide the product from the site and keep the record in admin for later recovery. Use this instead of permanent delete when you may need history or content back.",
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
