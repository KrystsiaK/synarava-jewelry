import type { Locale } from "@/lib/i18n/locales";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export type OrganizationSocialLink = {
  href: string;
};

const ABSOLUTE_HTTP_URL = /^https?:\/\//i;

/** Locale Organization.description — matches current store positioning (not couture-only). */
const ORGANIZATION_DESCRIPTION: Record<Locale, string> = {
  en: "Synarava is an online shop for jewellery and accessories focused on materials, form, symbolism and everyday wear.",
  pt: "Synarava é uma loja online de joalharia e acessórios com foco em materiais, forma, simbolismo e uso no dia a dia.",
  ru: "Synarava — интернет-магазин украшений и аксессуаров с акцентом на материалы, форму, символику и повседневную носку.",
};

/** Absolute http(s) social profiles for Organization.sameAs (deduped, stable order). */
export function organizationSameAs(
  socials: readonly OrganizationSocialLink[],
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const item of socials) {
    const href = item.href.trim();
    if (!ABSOLUTE_HTTP_URL.test(href) || seen.has(href)) continue;
    seen.add(href);
    urls.push(href);
  }
  return urls;
}

export function organizationDescription(locale: Locale = "en") {
  return ORGANIZATION_DESCRIPTION[locale] ?? ORGANIZATION_DESCRIPTION.en;
}

export function buildOrganizationJsonLd(
  socials: readonly OrganizationSocialLink[] = [],
  siteUrl: string = getPublicSiteUrl(),
  locale: Locale = "en",
) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Synarava",
    url: siteUrl,
    description: organizationDescription(locale),
    sameAs: organizationSameAs(socials),
  };
}
