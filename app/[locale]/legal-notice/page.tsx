import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { resolveLegalLastUpdatedLabel, resolveSharedLegalDate } from "@/lib/content/legal-date";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";
import { isSavedLegalDocument, resolveDocumentSections, resolveLegalText } from "@/lib/content/legal-sections";
import { shippedLegalEntries } from "@/lib/content/document-section-defaults";
import {
  LEGAL_NOTICE_INTRO_DEFAULT,
  LEGAL_NOTICE_LAST_UPDATED_DEFAULT,
} from "@/lib/content/legal-notice-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslations();
  const page = await getPageBySlug("legal-notice", locale);
  const { title, description } = localizedPageMetadataCopy({
    page,
    fallbackTitle: t("legal.notice.metaTitle"),
    fallbackDescription: t("legal.notice.metaDescription"),
  });
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
  const { t, locale } = await getServerTranslations();
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
  const lastUpdatedLabel = resolveLegalLastUpdatedLabel(
    page?.content.legalLastUpdatedLabel,
    t("legal.common.lastUpdated"),
  );
  const lastUpdated = resolveSharedLegalDate({
    date: page?.content.legalLastUpdated,
    saved: exists,
    fallbackDate: LEGAL_NOTICE_LAST_UPDATED_DEFAULT,
    translate: t,
  });

  return (
    <LegalDocumentPage
      heroImage={heroImage}
      eyebrowLabel={t("legal.common.eyebrow")}
      title={page?.title || t("legal.notice.title")}
      intro={intro}
      lastUpdatedLabel={lastUpdatedLabel}
      lastUpdated={lastUpdated}
      contentsLabel={t("legal.common.contents")}
      sections={sections}
      backHref={homeHref}
      backLabel={t("legal.common.backToStore")}
      nextHref={termsHref}
      nextLabel={t("legal.notice.nextLabel")}
    />
  );
}
