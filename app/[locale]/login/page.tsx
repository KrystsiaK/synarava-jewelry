import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { artifactButtonClasses, DisplayHeading } from "@/components/ui";
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
          <DisplayHeading as="h2" text={t("loginPage.panelTitle")} className="mt-3 text-[2.4rem] leading-none" />
        </div>
        {params.error === "shopify" ? (
          <p role="alert" className="border border-couture-red/40 p-4 text-sm text-couture-red">
            {t("loginPage.error")}
          </p>
        ) : null}
        {/* Document navigation, not next/link. A client fetch of this Route
            Handler follows the 307 to Shopify and is blocked by connect-src,
            then the fallback starts a second PKCE transaction. Shopify's
            hosted login (email code) only appears after this full navigation.
            https://shopify.dev/docs/api/customer/2026-10 */}
        <a
          href={shopifyAuthHref}
          data-component="CustomerSignInLink"
          className={artifactButtonClasses({ className: "w-full" })}
        >
          {t("loginPage.submit")}
        </a>
        <p className="text-sm leading-6 text-foreground/45">
          {t("loginPage.note")}
        </p>
      </div>
    </AuthShell>
  );
}
