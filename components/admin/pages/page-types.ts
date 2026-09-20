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
  editSectionEyebrow?: string;
  editSectionTitle?: string;
  editSectionBody?: string;
  editSectionCtaLabel?: string;
  materialSectionEyebrow?: string;
  materialSectionTitle?: string;
  materialSectionNoteLabel?: string;
  materialLexicon?: Array<{
    name?: string;
    category?: string;
    description?: string;
    image?: string;
    properties?: string;
  }>;
  manifestoSectionLabel?: string;
  manifestoSectionAttribution?: string;
  finalCtaLabel?: string;
  finalCtaHref?: string;
  finalFooterTitle?: string;
  finalContactLabel?: string;
  finalContactEmail?: string;
  legalIntro?: string;
  legalLastUpdated?: string;
  legalSections?: Record<string, { title?: string; body?: string }>;
  serviceSections?: Record<string, { title?: string; body?: string }>;
};

export type EditablePageContent = EditablePageCopy & {
  heroImage?: string;
  editProductIds?: string[];
  heroSectionEnabled?: boolean;
  departmentSectionEnabled?: boolean;
  archiveSectionEnabled?: boolean;
  editSectionEnabled?: boolean;
  materialSectionEnabled?: boolean;
  manifestoSectionEnabled?: boolean;
  finalCtaSectionEnabled?: boolean;
  translations?: { pt?: EditablePageCopy };
};
