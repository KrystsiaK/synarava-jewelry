import type { Metadata } from "next";

import { listCollections } from "@/lib/content/catalog";
import { CollectionsPage } from "@/components/collections/collections-page";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: "Collections",
    description:
      "Browse Synarava jewelry collections — Belarus Heritage, Earth Rituals, and Dark Symbols. Enter each story-world before choosing your piece.",
    alternates: buildAlternates(locale, "/collections"),
    openGraph: {
      url: localePath(locale, "/collections"),
      images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: "Synarava — Collections" }],
    },
  };
}

export default async function Page() {
  const collections = await listCollections();
  return <CollectionsPage collections={collections} />;
}