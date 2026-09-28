import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { resolveLegalLastUpdatedLabel, resolveSharedLegalDate } from "@/lib/content/legal-date";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { buildOpenGraphLocales } from "@/lib/seo/open-graph-locale";
import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";
import { isSavedLegalDocument, resolveDocumentSections, resolveLegalText } from "@/lib/content/legal-sections";
import { shippedLegalEntries } from "@/lib/content/document-section-defaults";
import {
  resolveTermsHeaderCopy,
  TERMS_INTRO_DEFAULT,
  TERMS_LAST_UPDATED_DEFAULT,
} from "@/lib/content/terms-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslations();
  const page = await getPageBySlug("terms-and-conditions", locale);
  const { title, description } = localizedPageMetadataCopy({
    page,
    fallbackTitle: t("legal.terms.metaTitle"),
    fallbackDescription: t("legal.terms.metaDescription"),
  });
  const openGraphLocales = await buildOpenGraphLocales(locale);

  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/terms-and-conditions"),
    openGraph: {
      ...openGraphLocales,
      url: localePath(locale, "/terms-and-conditions"),
      title,
      description,
      images: [{ url: page?.content.heroImage ?? "/og-default.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function TermsAndConditionsPage() {
  const { t, locale } = await getServerTranslations();
  const page = await getPageBySlug("terms-and-conditions", locale);
  const heroImage = page?.content.heroImage;
  const homeHref = localePath(locale, "/");
  const privacyHref = localePath(locale, "/privacy");

  const exists = isSavedLegalDocument(page);
  const sections = resolveDocumentSections(
    page?.content.legalSections,
    shippedLegalEntries("terms-and-conditions", locale),
    exists,
  );
  const intro = resolveLegalText(page?.content.legalIntro, exists ? "" : TERMS_INTRO_DEFAULT);
  const header = resolveTermsHeaderCopy({
    locale,
    eyebrow: page?.ownedEyebrow,
    excerpt: page?.ownedExcerpt,
    intro,
  });
  const lastUpdatedLabel = resolveLegalLastUpdatedLabel(
    page?.content.legalLastUpdatedLabel,
    t("legal.common.lastUpdated"),
  );
  const lastUpdated = resolveSharedLegalDate({
    date: page?.content.legalLastUpdated,
    saved: exists,
    fallbackDate: TERMS_LAST_UPDATED_DEFAULT,
    translate: t,
  });

  return (
    <LegalDocumentPage
      heroImage={heroImage}
      eyebrowLabel={header.eyebrow}
      title={page?.title || t("legal.terms.title")}
      intro={header.excerpt}
      lastUpdatedLabel={lastUpdatedLabel}
      lastUpdated={lastUpdated}
      contentsLabel={t("legal.common.contents")}
      sections={sections}
      backHref={homeHref}
      backLabel={t("legal.common.backToStore")}
      nextHref={privacyHref}
      nextLabel={t("legal.terms.nextLabel")}
    />
  );
}
