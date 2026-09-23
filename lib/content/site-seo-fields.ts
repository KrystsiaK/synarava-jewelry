// Site-wide SEO defaults editable on /admin/meta. Single language (English
// source) — matches the root layout metadata contract. Per-page and per-product
// SEO stay on Pages / Catalog.

export const SITE_SEO_KEY = "site-seo-v1";

export type SiteSeoFields = {
  defaultTitle: string;
  titleTemplate: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
};

/** Shipped fallbacks — must stay in sync with the previous hardcoded root metadata. */
export const SITE_SEO_DEFAULTS: SiteSeoFields = {
  defaultTitle: "Synarava — Curated Goods with Character",
  titleTemplate: "%s | Synarava",
  description:
    "A curated shop for jewelry, pet accessories, creative products for kids, and tools for making by hand.",
  ogTitle: "Synarava — Curated Goods with Character",
  ogDescription:
    "Jewelry, pet accessories, creative products for kids, and tools for making by hand.",
};

export const SITE_SEO_FIELD_DEFS: { key: keyof SiteSeoFields; label: string; hint: string; area?: boolean }[] = [
  {
    key: "defaultTitle",
    label: "Default title",
    hint: "Used when a page does not set its own title.",
  },
  {
    key: "titleTemplate",
    label: "Title template",
    hint: "Use %s for the page title. Example: %s | Synarava",
  },
  {
    key: "description",
    label: "Default description",
    hint: "Fallback meta description for pages without their own.",
    area: true,
  },
  {
    key: "ogTitle",
    label: "Open Graph title",
    hint: "Default social share title.",
  },
  {
    key: "ogDescription",
    label: "Open Graph description",
    hint: "Default social share description.",
    area: true,
  },
];
