import type { Metadata } from "next";

import { ServicePage } from "@/components/service/service-page";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return { title: t("service.returns.metaTitle"), description: t("service.returns.metaDescription") };
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
