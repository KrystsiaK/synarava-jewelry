// Curated list of translation keys the admin "Storefront copy" screen can
// override. Kept separate from the generic i18n key space on purpose: only
// keys listed here are editable, everything else in messages/*.json still
// requires a code change. Extend this list (not the form) to expose more.

export type StorefrontCopyField = {
  key: string;
  label: string;
  area?: boolean;
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

const SERVICE_PAGES = [
  { slug: "faq", title: "FAQ page", sections: ["maker", "availability", "payment", "question"] },
  { slug: "care", title: "Care Guide page", sections: ["jewelry", "pets", "kids", "tools"] },
  { slug: "shipping", title: "Shipping page", sections: ["options", "preparing", "tracking", "duties"] },
  { slug: "returns", title: "Returns page", sections: ["start", "condition", "personalised", "damage"] },
] as const;

function serviceGroup(page: (typeof SERVICE_PAGES)[number]): StorefrontCopyGroup {
  const base = `service.${page.slug}`;
  return {
    id: page.slug,
    title: page.title,
    description: "Meta title/description stay code-defined — only the on-page copy below is editable.",
    fields: [
      { key: `${base}.eyebrow`, label: "Eyebrow" },
      { key: `${base}.title`, label: "Title" },
      { key: `${base}.intro`, label: "Intro", area: true },
      ...page.sections.flatMap((section, index) => [
        { key: `${base}.sections.${section}Title`, label: `Section ${index + 1} title` },
        { key: `${base}.sections.${section}Body`, label: `Section ${index + 1} body`, area: true },
      ]),
    ],
  };
}

export const STOREFRONT_COPY_GROUPS: StorefrontCopyGroup[] = [
  NAV_GROUP,
  FOOTER_GROUP,
  ...SERVICE_PAGES.map(serviceGroup),
];

export const STOREFRONT_COPY_KEYS: string[] = STOREFRONT_COPY_GROUPS.flatMap(
  (group) => group.fields.map((field) => field.key),
);
