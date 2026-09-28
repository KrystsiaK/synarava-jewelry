import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { buildOpenGraphLocales } from "@/lib/seo/open-graph-locale";
import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";
import { resolveLegalLastUpdatedLabel, resolveSharedLegalDate } from "@/lib/content/legal-date";
import { isSavedLegalDocument, resolveDocumentSections, resolveLegalText } from "@/lib/content/legal-sections";
import { shippedLegalEntries } from "@/lib/content/document-section-defaults";
import {
  OFFER_INTRO_DEFAULT,
  OFFER_LAST_UPDATED_DEFAULT,
} from "@/lib/content/offer-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslations();
  const page = await getPageBySlug("offer", locale);
  const { title, description } = localizedPageMetadataCopy({
    page,
    fallbackTitle: t("legal.offer.metaTitle"),
    fallbackDescription: t("legal.offer.metaDescription"),
  });
  const openGraphLocales = await buildOpenGraphLocales(locale);

  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/offer"),
    openGraph: {
      ...openGraphLocales,
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
  const sections = resolveDocumentSections(
    page?.content.legalSections,
    shippedLegalEntries("offer", locale),
    exists,
  );
  const intro = resolveLegalText(page?.content.legalIntro, exists ? "" : OFFER_INTRO_DEFAULT);
  const lastUpdatedLabel = resolveLegalLastUpdatedLabel(
    page?.content.legalLastUpdatedLabel,
    t("legal.common.lastUpdated"),
  );
  const lastUpdated = resolveSharedLegalDate({
    date: page?.content.legalLastUpdated,
    saved: exists,
    fallbackDate: OFFER_LAST_UPDATED_DEFAULT,
    translate: t,
  });

  return (
    <LegalDocumentPage
      heroImage={heroImage}
      eyebrowLabel={t("legal.common.eyebrow")}
      title={page?.title || t("legal.offer.title")}
      intro={intro}
      lastUpdatedLabel={lastUpdatedLabel}
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
