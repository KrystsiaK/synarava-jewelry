import type { Metadata } from "next";
import { getPageBySlug, listCollections } from "@/lib/content/catalog";
import { getSiteVideos } from "@/lib/site-videos";
import { HomePage } from "@/components/home/home-page";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("home");
  const content = page?.content ?? {};

  return {
    title: page?.title ? { absolute: page.title } : "Synarava",
    description: page?.excerpt || undefined,
    alternates: { canonical: "/" },
    openGraph: {
      url: "/",
      images: content.heroImage
        ? [{ url: content.heroImage, width: 1200, height: 630, alt: page?.title || "Synarava" }]
        : [],
    },
  };
}

export default async function Page() {
  const [page, collectionData, videos] = await Promise.all([
    getPageBySlug("home"),
    listCollections(),
    getSiteVideos(),
  ]);

  const collections = collectionData
    .slice(0, 3)
    .map((c) => ({
      series: c.eyebrow,
      title: c.name,
      description: c.summary,
      price: "",
      image: c.heroImage,
      href: `/collections/${c.slug}`,
    }));

  const content = (page?.content ?? {}) as Record<string, string>;
  const heroImage = content.heroImage || collections[0]?.image || "";

  return (
    <HomePage
      title={page?.title}
      excerpt={page?.excerpt}
      content={{ ...content, heroImage, heroTitle: page?.title ?? "", heroBody: content.body ?? page?.excerpt ?? "" }}
      collections={collections}
      heroVideoSrc={[videos.homeBeads, videos.homeModel, videos.braceletFilm, videos.materialsFilm]}
    />
  );
}
