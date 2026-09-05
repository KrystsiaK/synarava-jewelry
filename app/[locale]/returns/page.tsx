import type { Metadata } from "next";

import { ServicePage } from "@/components/service/service-page";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslations();
  const title = t("service.returns.metaTitle");
  const description = t("service.returns.metaDescription");
  return {
    title,
    description,
    alternates: buildAlternates(locale, "/returns"),
    openGraph: {
      url: localePath(locale, "/returns"),
      title,
      description,
      images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function ReturnsPage() {
  const { t } = await getServerTranslations();
  return <ServicePage eyebrow={t("service.returns.eyebrow")} title={t("service.returns.title")} intro={t("service.returns.intro")} sections={[
    { title: t("service.returns.sections.startTitle"), body: t("service.returns.sections.startBody") },
    { title: t("service.returns.sections.conditionTitle"), body: t("service.returns.sections.conditionBody") },
    { title: t("service.returns.sections.personalisedTitle"), body: t("service.returns.sections.personalisedBody") },
    { title: t("service.returns.sections.damageTitle"), body: t("service.returns.sections.damageBody") },
  ]} />;
}
