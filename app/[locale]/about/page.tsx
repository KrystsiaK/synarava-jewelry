import type { Metadata } from "next";

import { getPageBySlug } from "@/lib/content/catalog";
import { getSiteVideos } from "@/lib/site-videos";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { AboutPage } from "@/components/about/about-page";

export async function generateMetadata(): Promise<Metadata> {
  const [page, locale] = await Promise.all([getPageBySlug("about"), getRequestLocale()]);
  const content = page?.content ?? {};

  return {
    title: page?.title || "About",
    description: page?.excerpt || undefined,
    alternates: buildAlternates(locale, "/about"),
    openGraph: {
      url: localePath(locale, "/about"),
      images: [
        content.heroImage
          ? { url: content.heroImage, width: 1200, height: 630, alt: page?.title || "About" }
          : { url: "/og-default.jpg", width: 1200, height: 630, alt: page?.title || "About" },
      ],
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
