import type { Metadata } from "next";

import { listCollections } from "@/lib/content/catalog";
import { CollectionsPage } from "@/components/collections/collections-page";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Browse Synarava jewelry collections — Belarus Heritage, Earth Rituals, and Dark Symbols. Enter each story-world before choosing your piece.",
  alternates: { canonical: "/collections" },
  openGraph: {
    url: "/collections",
    images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: "Synarava — Collections" }],
  },
};

export default async function Page() {
  const collections = await listCollections();
  return <CollectionsPage collections={collections} />;
}