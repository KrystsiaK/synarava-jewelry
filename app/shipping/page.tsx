import type { Metadata } from "next";

import { ServicePage } from "@/components/service/service-page";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return { title: t("service.shipping.metaTitle"), description: t("service.shipping.metaDescription") };
}

export default async function ShippingPage() {
  const { t } = await getServerTranslations();
  return <ServicePage eyebrow={t("service.shipping.eyebrow")} title={t("service.shipping.title")} intro={t("service.shipping.intro")} sections={[
    { title: t("service.shipping.sections.optionsTitle"), body: t("service.shipping.sections.optionsBody") },
    { title: t("service.shipping.sections.preparingTitle"), body: t("service.shipping.sections.preparingBody") },
    { title: t("service.shipping.sections.trackingTitle"), body: t("service.shipping.sections.trackingBody") },
    { title: t("service.shipping.sections.dutiesTitle"), body: t("service.shipping.sections.dutiesBody") },
  ]} />;
}
