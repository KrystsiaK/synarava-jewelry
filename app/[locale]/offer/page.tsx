import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";
import { isSavedLegalDocument, resolveLegalSections, resolveLegalText } from "@/lib/content/legal-sections";
import {
  OFFER_INTRO_DEFAULT,
  OFFER_LAST_UPDATED_DEFAULT,
  OFFER_SECTIONS,
  OFFER_SECTION_DEFAULTS,
} from "@/lib/content/offer-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslations();
  const page = await getPageBySlug("offer", locale);
  const { title, description } = localizedPageMetadataCopy({
    page,
    fallbackTitle: t("legal.offer.metaTitle"),
    fallbackDescription: t("legal.offer.metaDescription"),
  });
  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/offer"),
    openGraph: {
      url: localePath(locale, "/offer"),
      title,
      description,
      images: [{ url: page?.content.heroImage ?? "/og-default.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function OfferPage() {
  const { t, locale } = await getServerTranslations();
  const page = await getPageBySlug("offer", locale);
  const heroImage = page?.content.heroImage;
  const homeHref = localePath(locale, "/");
  const privacyHref = localePath(locale, "/privacy");

  const exists = isSavedLegalDocument(page);
  const sections = resolveLegalSections(OFFER_SECTIONS, page?.content.legalSections, exists ? {} : OFFER_SECTION_DEFAULTS);
  const intro = resolveLegalText(page?.content.legalIntro, exists ? "" : OFFER_INTRO_DEFAULT);
  const lastUpdated = resolveLegalText(page?.content.legalLastUpdated, exists ? "" : OFFER_LAST_UPDATED_DEFAULT);

  return (
    <LegalDocumentPage
      heroImage={heroImage}
      eyebrowLabel="Legal"
      title={page?.title || t("legal.offer.title")}
      intro={intro}
      lastUpdatedLabel={t("legal.common.lastUpdated")}
      lastUpdated={lastUpdated}
      contentsLabel={t("legal.common.contents")}
      sections={sections}
      backHref={homeHref}
      backLabel={t("legal.common.backToStore")}
      nextHref={privacyHref}
      nextLabel={t("legal.offer.nextLabel")}
    />
  );
}
