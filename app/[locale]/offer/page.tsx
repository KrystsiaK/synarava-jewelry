import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { resolveLegalSections, resolveLegalText } from "@/lib/content/legal-sections";
import {
  OFFER_INTRO_DEFAULT,
  OFFER_LAST_UPDATED_DEFAULT,
  OFFER_SECTIONS,
  OFFER_SECTION_DEFAULTS,
} from "@/lib/content/offer-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, page] = await Promise.all([getRequestLocale(), getPageBySlug("offer")]);
  const title = "Public Offer Agreement | Synarava";
  const description = "Terms of the public offer for the purchase of Synarava Jewelry products.";
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
  const [locale, page] = await Promise.all([getRequestLocale(), getPageBySlug("offer")]);
  const heroImage = page?.content.heroImage;
  const homeHref = localePath(locale, "/");
  const privacyHref = localePath(locale, "/privacy");

  const sections = resolveLegalSections(OFFER_SECTIONS, page?.content.legalSections, OFFER_SECTION_DEFAULTS);
  const intro = resolveLegalText(page?.content.legalIntro, OFFER_INTRO_DEFAULT);
  const lastUpdated = resolveLegalText(page?.content.legalLastUpdated, OFFER_LAST_UPDATED_DEFAULT);

  return (
    <LegalDocumentPage
      heroImage={heroImage}
      eyebrowLabel="Legal"
      title="Public Offer Agreement"
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
