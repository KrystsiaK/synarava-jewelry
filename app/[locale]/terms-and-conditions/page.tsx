import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { isSavedLegalDocument, resolveLegalSections, resolveLegalText } from "@/lib/content/legal-sections";
import {
  TERMS_EXCERPT_DEFAULT,
  TERMS_INTRO_DEFAULT,
  TERMS_LAST_UPDATED_DEFAULT,
  TERMS_SECTIONS,
  TERMS_SECTION_DEFAULTS,
} from "@/lib/content/terms-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const page = await getPageBySlug("terms-and-conditions", locale);
  const title = page?.title || "Terms & Conditions | Synarava";
  const description = page?.excerpt || TERMS_EXCERPT_DEFAULT;
  return {
    title,
    description,
    alternates: buildAlternates(locale, "/terms-and-conditions"),
    openGraph: {
      url: localePath(locale, "/terms-and-conditions"),
      title,
      description,
      images: [{ url: page?.content.heroImage ?? "/og-default.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function TermsAndConditionsPage() {
  const locale = await getRequestLocale();
  const page = await getPageBySlug("terms-and-conditions", locale);
  const heroImage = page?.content.heroImage;
  const homeHref = localePath(locale, "/");
  const privacyHref = localePath(locale, "/privacy");

  const exists = isSavedLegalDocument(page);
  const sections = resolveLegalSections(TERMS_SECTIONS, page?.content.legalSections, exists ? {} : TERMS_SECTION_DEFAULTS);
  const intro = resolveLegalText(page?.content.legalIntro, exists ? "" : TERMS_INTRO_DEFAULT);
  const lastUpdated = resolveLegalText(page?.content.legalLastUpdated, exists ? "" : TERMS_LAST_UPDATED_DEFAULT);

  return (
    <LegalDocumentPage
      heroImage={heroImage}
      eyebrowLabel="Legal"
      title={page?.title || "Terms & Conditions"}
      intro={intro}
      lastUpdatedLabel="Last updated"
      lastUpdated={lastUpdated}
      contentsLabel="Contents"
      sections={sections}
      backHref={homeHref}
      backLabel="← Back to store"
      nextHref={privacyHref}
      nextLabel="Privacy Policy →"
    />
  );
}
