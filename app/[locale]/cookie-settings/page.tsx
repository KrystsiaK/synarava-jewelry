import type { Metadata } from "next";
import { cookies } from "next/headers";

import { CookieSettingsView } from "@/components/privacy/cookie-settings-view";
import { PRIVACY_CONSENT_COOKIE } from "@/lib/privacy/consent";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslations();
  const title = t("cookieSettings.metaTitle");
  const description = t("cookieSettings.metaDescription");
  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/cookie-settings"),
    openGraph: {
      url: localePath(locale, "/cookie-settings"),
      title,
      description,
    },
  };
}

export default async function CookieSettingsPage() {
  const jar = await cookies();
  const initialConsent = jar.get(PRIVACY_CONSENT_COOKIE)?.value;

  return <CookieSettingsView initialConsent={initialConsent} />;
}
