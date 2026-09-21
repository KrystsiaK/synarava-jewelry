import { notFound } from "next/navigation";

import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

// The registry read backing alternates/params now touches the DB, which
// Next's background ISR revalidation of a "static" page can't do (throws
// DYNAMIC_SERVER_USAGE). Every route under here already reads
// cookies/headers per-request anyway — force-dynamic just makes that
// explicit instead of relying on Next's static/ISR inference.
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const locales = await getPublishedStorefrontLocales();
  return locales.map((locale) => ({ locale: locale.routeSegment }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const locales = await getPublishedStorefrontLocales();

  if (!locales.some((entry) => entry.routeSegment === locale)) {
    notFound();
  }

  return children;
}
