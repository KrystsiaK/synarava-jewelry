import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { isSavedLegalDocument, resolveDocumentSections, resolveLegalText } from "@/lib/content/legal-sections";
import { shippedLegalEntries } from "@/lib/content/document-section-defaults";
import {
  LEGAL_NOTICE_EXCERPT_DEFAULT,
  LEGAL_NOTICE_INTRO_DEFAULT,
  LEGAL_NOTICE_LAST_UPDATED_DEFAULT,
} from "@/lib/content/legal-notice-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const page = await getPageBySlug("legal-notice", locale);
  const title = page?.title || "Legal Notice | Synarava";
  const description = page?.excerpt || LEGAL_NOTICE_EXCERPT_DEFAULT;
  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/legal-notice"),
    openGraph: {
      url: localePath(locale, "/legal-notice"),
      title,
      description,
      images: [{ url: page?.content.heroImage ?? "/og-default.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function LegalNoticePage() {
  const locale = await getRequestLocale();
  const page = await getPageBySlug("legal-notice", locale);
  const heroImage = page?.content.heroImage;
  const homeHref = localePath(locale, "/");
  const termsHref = localePath(locale, "/terms-and-conditions");

  const exists = isSavedLegalDocument(page);
  const sections = resolveDocumentSections(
    page?.content.legalSections,
    shippedLegalEntries("legal-notice", locale),
    exists,
  );
  const intro = resolveLegalText(page?.content.legalIntro, exists ? "" : LEGAL_NOTICE_INTRO_DEFAULT);
  const lastUpdated = resolveLegalText(page?.content.legalLastUpdated, exists ? "" : LEGAL_NOTICE_LAST_UPDATED_DEFAULT);

  return (
    <LegalDocumentPage
      heroImage={heroImage}
      eyebrowLabel="Legal"
      title={page?.title || "Legal Notice"}
      intro={intro}
      lastUpdatedLabel="Last updated"
      lastUpdated={lastUpdated}
      contentsLabel="Contents"
      sections={sections}
      backHref={homeHref}
      backLabel="← Back to store"
      nextHref={termsHref}
      nextLabel="Terms & Conditions →"
    />
  );
}
