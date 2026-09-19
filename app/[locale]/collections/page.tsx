import type { Metadata } from "next";

import { getPageBySlug, listCollections } from "@/lib/content/catalog";
import { CollectionsPage } from "@/components/collections/collections-page";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, page] = await Promise.all([getRequestLocale(), getPageBySlug("collections")]);
  const heroImage = page?.content.heroImage;
  return {
    title: "Collections",
    description:
      "Browse Synarava's curated collections. Enter each story-world before choosing your piece.",
    alternates: buildAlternates(locale, "/collections"),
    openGraph: {
      url: localePath(locale, "/collections"),
      images: [{ url: heroImage || "/og-default.jpg", width: 1200, height: 630, alt: "Synarava — Collections" }],
    },
  };
}

export default async function Page() {
  const locale = await getRequestLocale();
  const [collections, page] = await Promise.all([
    listCollections(locale),
    getPageBySlug("collections"),
  ]);
  return <CollectionsPage collections={collections} heroImage={page?.content.heroImage} />;
}
