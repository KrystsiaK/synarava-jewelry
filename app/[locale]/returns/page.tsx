import type { Metadata } from "next";

import { ServicePageView } from "@/components/service/service-page-view";
import { getPageBySlug } from "@/lib/content/catalog";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";
import { resolveServiceDocumentSections, resolveLegalText } from "@/lib/content/legal-sections";
import { shippedServiceEntries } from "@/lib/content/document-section-defaults";
import {
  SERVICE_PAGE_TITLE_DEFAULTS,
  SERVICE_PAGE_INTRO_DEFAULTS,
} from "@/lib/content/service-page-defaults";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslations();
  const page = await getPageBySlug("returns", locale);
  const { title, description } = localizedPageMetadataCopy({
    page,
    fallbackTitle: t("service.returns.metaTitle"),
    fallbackDescription: t("service.returns.metaDescription"),
  });
  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/returns"),
    openGraph: {
      url: localePath(locale, "/returns"),
      title,
      description,
      images: [{ url: page?.content.heroImage ?? "/og-default.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function ReturnsPage() {
  const { locale } = await getServerTranslations();
  const page = await getPageBySlug("returns", locale);
  const content = page?.content;
  const introDefaults = (SERVICE_PAGE_INTRO_DEFAULTS[locale] ?? SERVICE_PAGE_INTRO_DEFAULTS.en).returns;

  return (
    <ServicePageView
      eyebrow={resolveLegalText(content?.eyebrow, introDefaults.eyebrow)}
      title={page?.title || (SERVICE_PAGE_TITLE_DEFAULTS[locale] ?? SERVICE_PAGE_TITLE_DEFAULTS.en).returns}
      intro={resolveLegalText(content?.body, introDefaults.intro)}
      sections={resolveServiceDocumentSections(
        content?.serviceSections,
        shippedServiceEntries("returns", locale),
      )}
      heroImage={content?.heroImage}
    />
  );
}
