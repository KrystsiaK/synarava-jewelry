import { notFound } from "next/navigation";

import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale: locale.code }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!SUPPORTED_LOCALES.some((entry) => entry.code === locale)) {
    notFound();
  }

  return children;
}
