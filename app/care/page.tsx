import type { Metadata } from "next";

import { ServicePage } from "@/components/service/service-page";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  const title = t("service.care.metaTitle");
  const description = t("service.care.metaDescription");
  return {
    title,
    description,
    alternates: { canonical: "/care" },
    openGraph: {
      url: "/care",
      title,
      description,
      images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function CarePage() {
  const { t } = await getServerTranslations();
  return <ServicePage eyebrow={t("service.care.eyebrow")} title={t("service.care.title")} intro={t("service.care.intro")} sections={[
    { title: t("service.care.sections.jewelryTitle"), body: t("service.care.sections.jewelryBody") },
    { title: t("service.care.sections.petsTitle"), body: t("service.care.sections.petsBody") },
    { title: t("service.care.sections.kidsTitle"), body: t("service.care.sections.kidsBody") },
    { title: t("service.care.sections.toolsTitle"), body: t("service.care.sections.toolsBody") },
  ]} />;
}
