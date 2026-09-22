import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";
import { isSavedLegalDocument, resolveLegalSections, resolveLegalText } from "@/lib/content/legal-sections";
import { PRIVACY_LAST_UPDATED_DEFAULT, PRIVACY_SECTIONS, PRIVACY_SECTION_DEFAULTS } from "@/lib/content/privacy-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslations();
  const page = await getPageBySlug("privacy", locale);
  const { title, description } = localizedPageMetadataCopy({
    page,
    fallbackTitle: t("legal.privacy.metaTitle"),
    fallbackDescription: t("legal.privacy.metaDescription"),
  });
  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/privacy"),
    openGraph: {
      url: localePath(locale, "/privacy"),
      title,
      description,
      images: [{ url: page?.content.heroImage ?? "/og-default.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function PrivacyPage() {
  const legalName = process.env.NEXT_PUBLIC_LEGAL_NAME ?? "Synarava Jewelry";
  const postalAddress = process.env.NEXT_PUBLIC_LEGAL_POSTAL_ADDRESS;
  const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "synarava.shop@gmail.com";
  const { t, locale } = await getServerTranslations();
  const page = await getPageBySlug("privacy", locale);
  const heroImage = page?.content.heroImage;
  const homeHref = localePath(locale, "/");
  const termsHref = localePath(locale, "/terms-and-conditions");

  const vars = {
    legalName,
    privacyEmail,
    postalAddressLine: postalAddress ? `${t("legal.privacy.postalAddressLabel")}: ${postalAddress}` : "",
  };

  const exists = isSavedLegalDocument(page);
  const sections = resolveLegalSections(
    PRIVACY_SECTIONS[locale],
    page?.content.legalSections,
    exists ? {} : PRIVACY_SECTION_DEFAULTS[locale],
    vars,
  );
  const lastUpdated = resolveLegalText(page?.content.legalLastUpdated, exists ? "" : PRIVACY_LAST_UPDATED_DEFAULT);

  return (
    <LegalDocumentPage
      heroImage={heroImage}
      eyebrowLabel="Legal"
      title={t("legal.privacy.title")}
      lastUpdatedLabel={t("legal.common.lastUpdated")}
      lastUpdated={lastUpdated}
      contentsLabel={t("legal.common.contents")}
      sections={sections}
      backHref={homeHref}
      backLabel={t("legal.common.backToStore")}
      nextHref={termsHref}
      nextLabel={t("legal.privacy.nextLabel")}
    />
  );
}
