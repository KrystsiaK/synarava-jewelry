import type { SavedPagePayload } from "@/app/admin/actions/pages";

export type PageRowAction = {
  page: SavedPagePayload;
  action: "publish" | "draft" | "archive";
};

export type EditablePageCopy = {
  title?: string;
  excerpt?: string;
  eyebrow?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  quote?: string;
  secondaryTitle?: string;
  secondaryBody?: string;
  departmentSectionTitle?: string;
  departmentSectionBody?: string;
  departmentSectionImageCaption?: string;
  departmentSectionCtaLabel?: string;
};

export type EditablePageContent = EditablePageCopy & {
  heroImage?: string;
  departmentSectionEnabled?: boolean;
  translations?: { pt?: EditablePageCopy };
};
