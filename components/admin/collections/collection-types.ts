import type { SavedCollectionPayload } from "@/app/admin/actions/collections";

export type AdminCollection = SavedCollectionPayload;

export type CollectionLocaleDraft = {
  localizedHandle: string;
  name: string;
  subtitle: string;
  description: string;
  manifesto: string;
  searchSummary: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  reviewed: boolean;
  syncStatus: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT";
  syncError: string;
};

export type CollectionDraft = {
  name: string;
  subtitle: string;
  slug: string;
  code: string;
  description: string;
  manifesto: string;
  searchSummary: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  workflowState: "DRAFT" | "PUBLISHED";
  pt: CollectionLocaleDraft;
};

export type CollectionRowAction = {
  collection: AdminCollection;
  action: "publish" | "draft" | "archive" | "delete";
};
