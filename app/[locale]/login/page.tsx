import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ArtifactLink } from "@/components/ui";
import { safeCustomerReturnPath } from "@/lib/shopify/customer-account/config";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";

type Props = {
  searchParams?: Promise<{
    redirectTo?: string;
    error?: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslations();
  const title = t("loginPage.metaTitle");
  const description = t("loginPage.metaDescription");
  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/login"),
    openGraph: {
      url: localePath(locale, "/login"),
      title,
      description,
    },
  };
}

export default async function LoginPage({ searchParams }: Props) {
  const [resolvedParams, { t, locale }] = await Promise.all([
    searchParams,
    getServerTranslations(),
  ]);
  const params = resolvedParams ?? {};
  const returnTo = safeCustomerReturnPath(params.redirectTo, locale);
  const shopifyAuthHref = `/api/auth/shopify?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AuthShell
      eyebrow={t("loginPage.eyebrow")}
      title={t("loginPage.title")}
      description={t("loginPage.description")}
      asideTitle={t("loginPage.asideTitle")}
      asideBody={t("loginPage.asideBody")}
      homeHref={localePath(locale, "/")}
      backLabel={t("loginPage.backToSite")}
    >
      <div className="space-y-6">
        <div>
          <p className="label-caps text-couture-red">{t("loginPage.panelEyebrow")}</p>
          <h2 className="mt-3 font-serif text-[2.4rem] leading-none">
            {t("loginPage.panelTitle")}
          </h2>
        </div>
        {params.error === "shopify" ? (
          <p role="alert" className="border border-couture-red/40 p-4 text-sm text-couture-red">
            {t("loginPage.error")}
          </p>
        ) : null}
        <ArtifactLink href={shopifyAuthHref} className="w-full">
          {t("loginPage.submit")}
        </ArtifactLink>
        <p className="text-sm leading-6 text-foreground/45">
          {t("loginPage.note")}
        </p>
      </div>
    </AuthShell>
  );
}
