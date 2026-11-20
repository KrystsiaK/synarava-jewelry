import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";

import { AnnouncementMarquee } from "@/components/ui/announcement-marquee";
import { REQUEST_PATHNAME_HEADER } from "@/lib/auth/admin-return-path";
import { shouldMountLayoutAnnouncementMarquee } from "@/lib/content/announcement-marquee-placement";
import { resolveStorefrontAnnouncementMessage } from "@/lib/content/resolve-storefront-announcement-message";
import { getStorefrontLocales, getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { resolveLocaleRequestDisposition } from "@/lib/i18n/locale-retirement-redirect";

// The registry read backing alternates/params now touches the DB, which
// Next's background ISR revalidation of a "static" page can't do (throws
// DYNAMIC_SERVER_USAGE). Every route under here already reads
// cookies/headers per-request anyway — force-dynamic just makes that
// explicit instead of relying on Next's static/ISR inference.
export const dynamic = "force-dynamic";

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
  const locales = await getStorefrontLocales();
  const disposition = await resolveLocaleRequestDisposition({
    localeSegment: locale,
    pathname: `/${locale}`,
    locales,
  });

  if (disposition.kind === "redirect") {
    permanentRedirect(disposition.pathname);
  }
  if (disposition.kind === "not-found") {
    notFound();
  }

  // Single exception gate for storefront marquee (admin is outside this tree;
  // About / unknown / 404 paths are excluded by the allowlist).
  const pathname = (await headers()).get(REQUEST_PATHNAME_HEADER);
  const layoutMarquee = shouldMountLayoutAnnouncementMarquee(pathname)
    ? await resolveStorefrontAnnouncementMessage()
    : null;

  if (!layoutMarquee) {
    return children;
  }

  return (
    <>
      <AnnouncementMarquee message={layoutMarquee} />
      {children}
    </>
  );
}
