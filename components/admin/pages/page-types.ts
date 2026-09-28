import type { SavedPagePayload } from "@/app/admin/actions/pages";
import type { ShopPageCopy } from "@/lib/content/shop-page-copy";

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
  calloutEyebrow?: string;
  calloutHeading?: string;
  calloutCtaHref?: string;
  heroOpeningLabel?: string;
  heroCountLabel?: string;
  heroQualifier?: string;
  detailShopLabel?: string;
  detailCollectionsLabel?: string;
  detailTeaserEyebrow?: string;
  detailTeaserHeading?: string;
  detailTeaserShopLabel?: string;
  quote?: string;
  secondaryTitle?: string;
  secondaryBody?: string;
  archiveSectionLabel?: string;
  editSectionEyebrow?: string;
  editSectionTitle?: string;
  editSectionBody?: string;
  editSectionViewAllLabel?: string;
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
  finalSecondaryCtaLabel?: string;
  finalSecondaryCtaHref?: string;
  finalFooterTitle?: string;
  finalContactLabel?: string;
  finalContactEmail?: string;
  finalContactEnabled?: boolean;
  legalIntro?: string;
  legalLastUpdated?: string;
  legalLastUpdatedLabel?: string;
  legalSections?: Array<{ id: string; label?: string; title?: string; body?: string }>
    | Record<string, { label?: string; title?: string; body?: string }>;
  serviceSections?: Array<{ id: string; label?: string; title?: string; body?: string }>
    | Record<string, { label?: string; title?: string; body?: string }>;
} & ShopPageCopy;

export type EditablePageContent = EditablePageCopy & {
  heroImage?: string;
  editProductIds?: string[];
  finalCtaProductIds?: string[];
  archiveCollectionIds?: string[];
  heroSectionEnabled?: boolean;
  archiveSectionEnabled?: boolean;
  editSectionEnabled?: boolean;
  materialSectionEnabled?: boolean;
  manifestoSectionEnabled?: boolean;
  finalCtaSectionEnabled?: boolean;
  translations?: { pt?: EditablePageCopy };
};
