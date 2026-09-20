// Curated list of translation keys the admin "Storefront copy" screen can
// override. Kept separate from the generic i18n key space on purpose: only
// keys listed here are editable, everything else in messages/*.json still
// requires a code change. Extend this list (not the form) to expose more.

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

const NAV_GROUP: StorefrontCopyGroup = {
  id: "nav",
  title: "Main menu",
  fields: [
    { key: "nav.home", label: "Home" },
    { key: "nav.shop", label: "Shop" },
    { key: "nav.collections", label: "Collections" },
    { key: "nav.about", label: "About" },
  ],
};

const FOOTER_GROUP: StorefrontCopyGroup = {
  id: "footer",
  title: "Footer",
  fields: [
    { key: "footer.tagline", label: "Tagline (under the logo)" },
    { key: "footer.copyright", label: "Copyright line" },
    { key: "footer.navigationHeading", label: "“Navigation” column heading" },
    { key: "footer.serviceHeading", label: "“Service” column heading" },
    { key: "footer.shop", label: "Link — Shop" },
    { key: "footer.collections", label: "Link — Collections" },
    { key: "footer.about", label: "Link — About" },
    { key: "footer.careGuide", label: "Link — Care Guide" },
    { key: "footer.shipping", label: "Link — Shipping" },
    { key: "footer.returns", label: "Link — Returns" },
    { key: "footer.faq", label: "Link — FAQ" },
    { key: "footer.contact", label: "Link — Contact label" },
    { key: "footer.privacyPolicy", label: "Link — Privacy Policy" },
    { key: "footer.publicOffer", label: "Link — Public Offer" },
    { key: "footer.offerGovernedBy", label: "“All purchases are governed by our…” prefix" },
    { key: "footer.offerTerms", label: "…offer terms” link text" },
  ],
};

// Shop's hero copy and the 4 service pages' (care/faq/returns/shipping) eyebrow/
// title/intro/sections live on the Page record instead (edited in Pages -> that
// slug) — a single screen per page, consistent with how home/about already work,
// rather than splitting one page's copy across two admin screens.

export const STOREFRONT_COPY_GROUPS: StorefrontCopyGroup[] = [
  NAV_GROUP,
  FOOTER_GROUP,
];

export const STOREFRONT_COPY_KEYS: string[] = STOREFRONT_COPY_GROUPS.flatMap(
  (group) => group.fields.map((field) => field.key),
);
