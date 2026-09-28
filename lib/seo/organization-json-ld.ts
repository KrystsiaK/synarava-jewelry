import { getPublicSiteUrl } from "@/lib/seo/site-url";

export type OrganizationSocialLink = {
  href: string;
};

const ABSOLUTE_HTTP_URL = /^https?:\/\//i;

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

export function buildOrganizationJsonLd(
  socials: readonly OrganizationSocialLink[] = [],
  siteUrl: string = getPublicSiteUrl(),
) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Synarava",
    url: siteUrl,
    description:
      "Handcrafted couture jewelry rooted in folk symbolism and contemporary design.",
    sameAs: organizationSameAs(socials),
  };
}
