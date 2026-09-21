import { notFound } from "next/navigation";

import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

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
