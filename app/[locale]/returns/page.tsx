import type { Metadata } from "next";

import { ServicePage } from "@/components/service/service-page";
import { getPageBySlug } from "@/lib/content/catalog";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";
import { resolveLegalSections, resolveLegalText } from "@/lib/content/legal-sections";
import {
  SERVICE_SECTIONS,
  SERVICE_SECTION_DEFAULTS_EN,
  SERVICE_SECTION_DEFAULTS_PT,
  SERVICE_PAGE_TITLE_DEFAULTS_EN,
  SERVICE_PAGE_TITLE_DEFAULTS_PT,
  SERVICE_PAGE_INTRO_DEFAULTS_EN,
  SERVICE_PAGE_INTRO_DEFAULTS_PT,
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
    alternates: buildAlternates(locale, "/returns"),
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
  const isPt = locale === "pt";
  const introDefaults = (isPt ? SERVICE_PAGE_INTRO_DEFAULTS_PT : SERVICE_PAGE_INTRO_DEFAULTS_EN).returns;

  return (
    <ServicePage
      eyebrow={resolveLegalText(content?.eyebrow, introDefaults.eyebrow)}
      title={page?.title || (isPt ? SERVICE_PAGE_TITLE_DEFAULTS_PT : SERVICE_PAGE_TITLE_DEFAULTS_EN).returns}
      intro={resolveLegalText(content?.body, introDefaults.intro)}
      sections={resolveLegalSections(
        SERVICE_SECTIONS.returns,
        content?.serviceSections,
        (isPt ? SERVICE_SECTION_DEFAULTS_PT : SERVICE_SECTION_DEFAULTS_EN).returns,
      )}
      heroImage={content?.heroImage}
    />
  );
}
