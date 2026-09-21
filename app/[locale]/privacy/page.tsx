import type { Metadata } from "next";

import { PrivacySettingsButton } from "@/components/privacy/privacy-settings-button";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { resolveLegalSections, resolveLegalText } from "@/lib/content/legal-sections";
import {
  PRIVACY_LAST_UPDATED_DEFAULT,
  PRIVACY_SECTIONS_EN,
  PRIVACY_SECTIONS_PT,
  PRIVACY_SECTION_DEFAULTS_EN,
  PRIVACY_SECTION_DEFAULTS_PT,
} from "@/lib/content/privacy-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const page = await getPageBySlug("privacy", locale);
  const base = locale === "pt" ? {
    title: "Política de Privacidade | Synarava",
    description: "Como a Synarava recolhe, utiliza e protege os seus dados pessoais.",
  } : {
    title: "Privacy Policy | Synarava",
    description: "How Synarava Jewelry collects, uses, and protects your personal data.",
  };
  return {
    ...base,
    alternates: buildAlternates(locale, "/privacy"),
    openGraph: {
      url: localePath(locale, "/privacy"),
      ...base,
      images: [{ url: page?.content.heroImage ?? "/og-default.jpg", width: 1200, height: 630, alt: base.title }],
    },
  };
}

export default async function PrivacyPage() {
  const legalName = process.env.NEXT_PUBLIC_LEGAL_NAME ?? "Synarava Jewelry";
  const postalAddress = process.env.NEXT_PUBLIC_LEGAL_POSTAL_ADDRESS;
  const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "synarava.shop@gmail.com";
  const locale = await getRequestLocale();
  const page = await getPageBySlug("privacy", locale);
  const heroImage = page?.content.heroImage;
  const homeHref = localePath(locale, "/");
  const offerHref = localePath(locale, "/offer");
  const isPt = locale === "pt";

  const vars = {
    legalName,
    privacyEmail,
    postalAddressLine: postalAddress ? `${isPt ? "Morada postal" : "Postal address"}: ${postalAddress}` : "",
  };

  const sections = resolveLegalSections(
    isPt ? PRIVACY_SECTIONS_PT : PRIVACY_SECTIONS_EN,
    page?.content.legalSections,
    isPt ? PRIVACY_SECTION_DEFAULTS_PT : PRIVACY_SECTION_DEFAULTS_EN,
    vars,
  );
  const lastUpdated = resolveLegalText(page?.content.legalLastUpdated, PRIVACY_LAST_UPDATED_DEFAULT);

  return (
    <LegalDocumentPage
      heroImage={heroImage}
      eyebrowLabel="Legal"
      title={isPt ? "Política de Privacidade" : "Privacy Policy"}
      lastUpdatedLabel={isPt ? "Última atualização" : "Last updated"}
      lastUpdated={lastUpdated}
      contentsLabel={isPt ? "Índice" : "Contents"}
      sections={sections}
      backHref={homeHref}
      backLabel={isPt ? "← Voltar à loja" : "← Back to store"}
      nextHref={offerHref}
      nextLabel={isPt ? "Termos e Condições →" : "Terms & Conditions →"}
      renderSectionExtra={(id) => (id === "cookies" ? (
        <div className="mt-4 inline-flex border border-stroke px-4 py-3">
          <PrivacySettingsButton />
        </div>
      ) : null)}
    />
  );
}
