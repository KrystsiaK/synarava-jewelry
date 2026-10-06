import type { Metadata } from "next";

import { getPageBySlug } from "@/lib/content/catalog";
import { getSiteVideos } from "@/lib/site-videos";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath, storefrontHref } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { buildOpenGraphLocales } from "@/lib/seo/open-graph-locale";
import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";
import { AboutPage } from "@/components/about/about-page";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const page = await getPageBySlug("about", locale);
  const content = page?.content ?? {};
  const { title, description } = localizedPageMetadataCopy({
    page,
    fallbackTitle: "About",
    fallbackDescription: "",
  });

  const openGraphLocales = await buildOpenGraphLocales(locale);

  return {
    title,
    description: description || undefined,
    alternates: await buildAlternates(locale, "/about"),
    openGraph: {
      ...openGraphLocales,
      title,
      description: description || undefined,
      url: localePath(locale, "/about"),
      images: [
        content.heroImage
          ? { url: content.heroImage, width: 1200, height: 630, alt: title }
          : { url: "/og-default.jpg", width: 1200, height: 630, alt: title },
      ],
    },
  };
}

export default async function Page() {
  const locale = await getRequestLocale();
  const [page, videos] = await Promise.all([getPageBySlug("about", locale), getSiteVideos()]);
  const content = page?.content ?? {};

  return (
    <AboutPage
      title={page?.title ?? ""}
      excerpt={content.body ?? page?.excerpt ?? ""}
      eyebrow={content.eyebrow ?? ""}
      ctaHref={content.ctaHref ? storefrontHref(locale, content.ctaHref) : ""}
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
