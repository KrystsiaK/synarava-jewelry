import type { Metadata } from "next";

import { getPageBySlug } from "@/lib/content/catalog";
import { getSiteVideos } from "@/lib/site-videos";
import { AboutPage } from "@/components/about/about-page";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("about");
  const content = page?.content ?? {};

  return {
    title: page?.title || "About",
    description: page?.excerpt || undefined,
    alternates: { canonical: "/about" },
    openGraph: {
      url: "/about",
      images: content.heroImage
        ? [{ url: content.heroImage, width: 1200, height: 630, alt: page?.title || "About" }]
        : [],
    },
  };
}

export default async function Page() {
  const [page, videos] = await Promise.all([getPageBySlug("about"), getSiteVideos()]);
  const content = page?.content ?? {};

  return (
    <AboutPage
      title={page?.title ?? ""}
      excerpt={content.body ?? page?.excerpt ?? ""}
      eyebrow={content.eyebrow ?? ""}
      ctaHref={content.ctaHref ?? ""}
      ctaLabel={content.ctaLabel ?? ""}
      secondaryTitle={content.secondaryTitle}
      secondaryBody={content.secondaryBody ?? ""}
      quote={content.quote}
      heroVideoSrc={videos.braceletFilm}
      heroImage={content.heroImage}
      materialVideoSrc={videos.materialsFilm}
    />
  );
}
