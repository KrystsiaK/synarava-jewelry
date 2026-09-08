import type { SavedCollectionPayload } from "@/app/admin/actions/collections";

export type AdminCollection = SavedCollectionPayload;

export type CollectionDraft = {
  name: string;
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
};

export type CollectionRowAction = {
  collection: AdminCollection;
  action: "publish" | "draft" | "archive" | "delete";
};
