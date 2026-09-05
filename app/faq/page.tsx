import type { Metadata } from "next";

import { ServicePage } from "@/components/service/service-page";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  const title = t("service.faq.metaTitle");
  const description = t("service.faq.metaDescription");
  return {
    title,
    description,
    alternates: { canonical: "/faq" },
    openGraph: {
      url: "/faq",
      title,
      description,
      images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function FaqPage() {
  const { t } = await getServerTranslations();
  return <ServicePage eyebrow={t("service.faq.eyebrow")} title={t("service.faq.title")} intro={t("service.faq.intro")} sections={[
    { title: t("service.faq.sections.makerTitle"), body: t("service.faq.sections.makerBody") },
    { title: t("service.faq.sections.availabilityTitle"), body: t("service.faq.sections.availabilityBody") },
    { title: t("service.faq.sections.paymentTitle"), body: t("service.faq.sections.paymentBody") },
    { title: t("service.faq.sections.questionTitle"), body: t("service.faq.sections.questionBody") },
  ]} />;
}
