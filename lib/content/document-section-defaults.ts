import type { Locale } from "@/lib/i18n/locales";
import {
  buildLegalSectionEntries,
  type LegalSectionEntry,
} from "@/lib/content/legal-sections";
import {
  LEGAL_NOTICE_SECTIONS,
  LEGAL_NOTICE_SECTION_DEFAULTS,
} from "@/lib/content/legal-notice-defaults";
import {
  OFFER_SECTIONS,
  OFFER_SECTION_DEFAULTS,
} from "@/lib/content/offer-defaults";
import {
  PRIVACY_SECTIONS,
  PRIVACY_SECTION_DEFAULTS,
} from "@/lib/content/privacy-defaults";
import {
  SERVICE_SECTION_DEFAULTS,
  SERVICE_SECTIONS,
  type ServicePageSlug,
} from "@/lib/content/service-page-defaults";
import {
  TERMS_SECTIONS,
  TERMS_SECTION_DEFAULTS,
} from "@/lib/content/terms-defaults";

export const LEGAL_DOCUMENT_SLUGS = [
  "privacy",
  "offer",
  "terms-and-conditions",
  "legal-notice",
] as const;

export type LegalDocumentSlug = (typeof LEGAL_DOCUMENT_SLUGS)[number];

export function isLegalDocumentSlug(slug: string): slug is LegalDocumentSlug {
  return (LEGAL_DOCUMENT_SLUGS as readonly string[]).includes(slug);
}

export function isServicePageSlug(slug: string): slug is ServicePageSlug {
  return Object.prototype.hasOwnProperty.call(SERVICE_SECTIONS, slug);
}

export function shippedLegalEntries(
  slug: LegalDocumentSlug,
  locale: Locale = "en",
): LegalSectionEntry[] {
  if (slug === "privacy") {
    return buildLegalSectionEntries(
      PRIVACY_SECTIONS[locale] ?? PRIVACY_SECTIONS.en,
      PRIVACY_SECTION_DEFAULTS[locale] ?? PRIVACY_SECTION_DEFAULTS.en,
    );
  }
  if (slug === "terms-and-conditions") {
    return buildLegalSectionEntries(TERMS_SECTIONS, TERMS_SECTION_DEFAULTS);
  }
  if (slug === "legal-notice") {
    return buildLegalSectionEntries(LEGAL_NOTICE_SECTIONS, LEGAL_NOTICE_SECTION_DEFAULTS);
  }
  return buildLegalSectionEntries(OFFER_SECTIONS, OFFER_SECTION_DEFAULTS);
}

export function shippedServiceEntries(
  slug: ServicePageSlug,
  locale: Locale = "en",
): LegalSectionEntry[] {
  const sections = SERVICE_SECTIONS[slug];
  const defaults = (SERVICE_SECTION_DEFAULTS[locale] ?? SERVICE_SECTION_DEFAULTS.en)[slug];
  return buildLegalSectionEntries(sections, defaults);
}
