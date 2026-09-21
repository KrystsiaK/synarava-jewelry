import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { isSavedLegalDocument, resolveLegalSections, resolveLegalText } from "@/lib/content/legal-sections";
import {
  OFFER_INTRO_DEFAULT,
  OFFER_LAST_UPDATED_DEFAULT,
  OFFER_SECTIONS,
  OFFER_SECTION_DEFAULTS,
} from "@/lib/content/offer-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const page = await getPageBySlug("offer", locale);
  const title = page?.title || (locale === "pt" ? "Condições gerais de venda | Synarava" : "Public Offer Agreement | Synarava");
  const description = page?.excerpt || (locale === "pt"
    ? "Condições gerais para a compra de produtos Synarava."
    : "Terms of the public offer for the purchase of Synarava Jewelry products.");
  return {
    title,
    description,
    alternates: buildAlternates(locale, "/offer"),
    openGraph: {
      url: localePath(locale, "/offer"),
      title,
      description,
      images: [{ url: page?.content.heroImage ?? "/og-default.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function OfferPage() {
  const locale = await getRequestLocale();
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
      title={page?.title || (locale === "pt" ? "Condições gerais de venda" : "Public Offer Agreement")}
      intro={intro}
      lastUpdatedLabel={locale === "pt" ? "Última atualização" : "Last updated"}
      lastUpdated={lastUpdated}
      contentsLabel={locale === "pt" ? "Índice" : "Contents"}
      sections={sections}
      backHref={homeHref}
      backLabel={locale === "pt" ? "← Voltar à loja" : "← Back to store"}
      nextHref={privacyHref}
      nextLabel={locale === "pt" ? "Política de privacidade →" : "Privacy Policy →"}
    />
  );
}
