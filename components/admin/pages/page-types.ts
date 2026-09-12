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
  archiveSectionLabel?: string;
  materialSectionEyebrow?: string;
  materialSectionTitle?: string;
  manifestoSectionLabel?: string;
  manifestoSectionAttribution?: string;
  finalCtaLabel?: string;
  finalCtaHref?: string;
  finalFooterTitle?: string;
  finalContactLabel?: string;
  finalContactEmail?: string;
};

export type EditablePageContent = EditablePageCopy & {
  heroImage?: string;
  heroSectionEnabled?: boolean;
  departmentSectionEnabled?: boolean;
  archiveSectionEnabled?: boolean;
  materialSectionEnabled?: boolean;
  manifestoSectionEnabled?: boolean;
  finalCtaSectionEnabled?: boolean;
  translations?: { pt?: EditablePageCopy };
};
