import type { Metadata } from "next";

import { getPageBySlug } from "@/lib/content/catalog";
import { getSiteVideos } from "@/lib/site-videos";
import { AboutPage } from "@/components/about/about-page";

export const metadata: Metadata = {
  title: "About the Studio",
  description:
    "Learn about Synarava studio — its materials, process, and editorial point of view. Collectible jewelry rooted in Belarusian heritage.",
  alternates: { canonical: "/about" },
  openGraph: {
    url: "/about",
    images: [
      {
        url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAsOpilx95kk9tsj12r0FFG2UFEpnvVCSCj8zjj1_un-K347C_bYyfjiBfHqVhN7zzUIZ6ozazQxs49HgYM0nwLxVV_V-oCjDAD6QJftXKg4uJF9VXZZMF7SnXTuGUbTcXpb8YpkhuyReJ5XbM6cmIPd1_ZewFgYq_eM3-SzvrzxvrGS91YDoHIO1EY-VONHmNa2LsvHgEWNqfyALYgIDXy_TuRnrTrcjodxqPvTs-9GvTow0A7s7QXartwC2wPcxedNcDYyDBOZOpL",
        width: 1200,
        height: 630,
        alt: "Synarava studio composition",
      },
    ],
  },
};

export default async function Page() {
  const [page, videos] = await Promise.all([getPageBySlug("about"), getSiteVideos()]);
  const content = page?.content ?? {};

  return (
    <AboutPage
      title={page?.title ?? "A jewelry studio shaped like an exhibition."}
      excerpt={
        page?.excerpt ??
        "Synarava makes collectible jewelry with a calm, editorial point of view. The brand sits between store and archive, pairing accessible product browsing with a deeper world of material stories, folk geometry, and atelier process."
      }
      eyebrow={content.eyebrow ?? "About the studio"}
      ctaHref={content.ctaHref ?? "/shop"}
      ctaLabel={content.ctaLabel ?? "Shop all products"}
      secondaryBody={
        content.secondaryBody ??
        "The idea is simple: if someone wants to buy, they should go to Shop. If they want the broader aesthetic context, they should go to Collections. If they want to understand the studio itself, they should come here. The manifesto remains available, but it no longer replaces the About page."
      }
      heroVideoSrc={videos.braceletFilm}
      materialVideoSrc={videos.materialsFilm}
    />
  );
}
