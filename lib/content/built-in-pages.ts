export const BUILT_IN_PAGE_DEFINITIONS = [
  { slug: "home", title: "Home", template: "HOME" },
  { slug: "about", title: "About", template: "STATIC_PAGE" },
  { slug: "shop", title: "Shop", template: "STATIC_PAGE" },
  { slug: "collections", title: "Collections", template: "COLLECTION_INDEX" },
  { slug: "care", title: "Care Guide", template: "STATIC_PAGE" },
  { slug: "shipping", title: "Shipping", template: "STATIC_PAGE" },
  { slug: "returns", title: "Returns", template: "STATIC_PAGE" },
  { slug: "faq", title: "FAQ", template: "STATIC_PAGE" },
  { slug: "offer", title: "Public Offer Agreement", template: "STATIC_PAGE" },
  { slug: "privacy", title: "Privacy Policy", template: "STATIC_PAGE" },
  { slug: "dispute-resolution", title: "Consumer Dispute Resolution", template: "STATIC_PAGE" },
  { slug: "legal-notice", title: "Legal Notice", template: "STATIC_PAGE" },
] as const;

const BUILT_IN_PAGE_SLUGS = new Set<string>(
  BUILT_IN_PAGE_DEFINITIONS.map((page) => page.slug),
);

export function isBuiltInPage(slug: string) {
  return BUILT_IN_PAGE_SLUGS.has(slug);
}
