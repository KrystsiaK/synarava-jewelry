// Curated list of translation keys the admin "Shared" screen can override.
// Kept separate from the generic i18n key space on purpose: only keys listed
// here are editable; everything else in messages/*.json still requires a code
// change. Extend this list (not the form) to expose more.
//
// Header main links → header-nav-v1.
// Footer service / legal / socials links → footer-links-v1.
// Contact emails → footer-contact-v1.
// Remaining groups are labels only (headings, chrome, CTA copy).

// Lives here (not storefront-copy.ts) because that module is `server-only`
// (it touches the database) — this constant is also needed by client
// components, so storefront-copy.ts re-exports it from here instead of
// declaring its own copy.
export const STOREFRONT_COPY_KEY = "storefront-copy-v1";

export type StorefrontCopyField = {
  key: string;
  label: string;
  area?: boolean;
  /** Short tooltip explaining exactly what this field controls on the storefront. */
  hint?: string;
};

export type StorefrontCopyGroup = {
  id: string;
  title: string;
  description?: string;
  fields: StorefrontCopyField[];
};

const HEADER_CHROME_GROUP: StorefrontCopyGroup = {
  id: "header-chrome",
  title: "Header — cart & account",
  description: "Cart, login, and menu control labels in the header and mobile drawer.",
  fields: [
    { key: "nav.cart", label: "Cart" },
    { key: "nav.login", label: "Login" },
    { key: "nav.account", label: "My Account" },
    { key: "nav.loginRegister", label: "Login / Register" },
    { key: "nav.openMenu", label: "Open menu (aria)" },
    { key: "nav.closeMenu", label: "Close menu (aria)" },
  ],
};

const FOOTER_BRAND_GROUP: StorefrontCopyGroup = {
  id: "footer-brand",
  title: "Footer — brand",
  description: "Tagline and copyright beside the logo. Layout is fixed.",
  fields: [
    { key: "footer.tagline", label: "Tagline (under the logo)" },
    { key: "footer.copyright", label: "Copyright line" },
  ],
};

const FOOTER_NAV_GROUP: StorefrontCopyGroup = {
  id: "footer-nav",
  title: "Footer — navigation column",
  description:
    "Column heading only. Link names and paths come from Header — main links (same menu).",
  fields: [
    { key: "footer.navigationHeading", label: "Column heading" },
  ],
};

const FOOTER_SERVICE_HEADING_GROUP: StorefrontCopyGroup = {
  id: "footer-service-heading",
  title: "Footer — service heading",
  description:
    "Column heading and contact aria label. Service links and emails are edited in the sections above.",
  fields: [
    { key: "footer.serviceHeading", label: "Column heading" },
    { key: "footer.contact", label: "Contact label (aria)" },
  ],
};

const FOOTER_SOCIAL_HEADING_GROUP: StorefrontCopyGroup = {
  id: "footer-social-heading",
  title: "Footer — social heading",
  description: "Optional heading shown when at least one social link is configured.",
  fields: [
    { key: "footer.socialHeading", label: "Column heading" },
  ],
};

const SERVICE_CONTACT_GROUP: StorefrontCopyGroup = {
  id: "service-contact",
  title: "Shared — contact CTA",
  description:
    "Banner on Care, FAQ, Shipping, Returns, and Dispute Resolution. The button mailto uses the primary Contact email.",
  fields: [
    {
      key: "service.contactTitle",
      label: "Title",
      hint: "All-caps headline above the contact CTA body.",
    },
    {
      key: "service.contactBody",
      label: "Body",
      area: true,
      hint: "Supporting sentence under the title.",
    },
    {
      key: "service.contactCta",
      label: "Button label",
      hint: "Label on the outlined contact button.",
    },
  ],
};

// Shop hero copy and per-page service intro/sections (care/faq/returns/shipping)
// live on the Page record (Pages → that slug). The shared contact CTA above is
// the exception — one banner for all service pages.

export const STOREFRONT_COPY_GROUPS: StorefrontCopyGroup[] = [
  HEADER_CHROME_GROUP,
  FOOTER_BRAND_GROUP,
  FOOTER_NAV_GROUP,
  FOOTER_SERVICE_HEADING_GROUP,
  FOOTER_SOCIAL_HEADING_GROUP,
  SERVICE_CONTACT_GROUP,
];

export const STOREFRONT_COPY_KEYS: string[] = STOREFRONT_COPY_GROUPS.flatMap(
  (group) => group.fields.map((field) => field.key),
);
