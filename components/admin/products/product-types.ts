import type { SavedProductPayload } from "@/app/admin/actions/products";
import type { SavedTagPayload } from "@/app/admin/actions/tags";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";

export type CategoryOption = { slug: string; name: string };
export type TagOption = SavedTagPayload;
export type CollectionOption = { id: string; slug: string; name: string; isPrimaryNav: boolean; navSortOrder: number };
export type ProductRecord = SavedProductPayload;

export type ProductCmsProps = {
  initialProducts: ProductRecord[];
  categories: CategoryOption[];
  tags: TagOption[];
  collections: CollectionOption[];
  issues?: AdminIssueSummary[];
};

export type ProductDraft = {
  name: string;
  slug: string;
  sku: string;
  price: string;
  seriesLabel: string;
  shortDescription: string;
  description: string;
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
};

export type ProductRowAction = {
  product: ProductRecord;
  action: "publish" | "draft" | "archive" | "delete";
};

export type SyncConfirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  remoteProductIds: string[];
  localProductIds: string[];
  archiveProductIds: string[];
  tone?: "default" | "danger";
};
