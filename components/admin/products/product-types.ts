import type { SavedProductPayload } from "@/app/admin/actions/products";
import type { SavedTagPayload } from "@/app/admin/actions/tags";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

export type CategoryOption = { slug: string; name: string };
export type TagOption = SavedTagPayload;
export type CollectionOption = {
  id: string;
  slug: string;
  name: string;
  isStorefrontDefault: boolean;
  shopifyCollectionId: string | null;
};
export type ProductRecord = SavedProductPayload;

export type ProductCmsProps = {
  initialProducts: ProductRecord[];
  categories: CategoryOption[];
  tags: TagOption[];
  collections: CollectionOption[];
  issues?: AdminIssueSummary[];
  initialConflictSignals: CatalogConflictSignals;
};

export type ProductDraft = {
  name: string;
  vendor: string;
  productType: string;
  slug: string;
  sku: string;
  price: string;
  seriesLabel: string;
  shortDescription: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  materialLine: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  shopifyCategoryId: string;
  shopifyCategoryName: string;
  collectionSlug: string;
  tags: string;
  workflowState: "DRAFT" | "PUBLISHED" | "UNLISTED";
  imageUrl: string;
  stockOnHand: string;
  translations: Record<string, ProductLocaleDraft>;
};

export type ProductLocaleDetailsDraft = {
  attributes: Array<{ label: string; value: string }>;
  materialsEyebrow: string;
  materialsTitle: string;
  materials: Array<{ title: string; body: string }>;
  process: { eyebrow: string; title: string; stats: Array<{ value: string; label: string }> };
  lookbookEyebrow: string;
  lookbookTitle: string;
  lookbook: Array<{ label: string }>;
};

export type ProductLocaleDraft = {
  localizedHandle: string;
  title: string;
  shortDescription: string;
  description: string;
  materialLine: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  seoTitle: string;
  seoDescription: string;
  details: ProductLocaleDetailsDraft;
  reviewed: boolean;
  syncStatus: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT";
  syncError: string;
};

export type ProductRowAction = {
  product: ProductRecord;
  action: "publish" | "draft" | "archive" | "delete";
};
