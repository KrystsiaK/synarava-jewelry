// Curated list of translation keys the admin "Shared" screen can override.
// Kept separate from the generic i18n key space on purpose: only keys listed
// here are editable; everything else in messages/*.json still requires a code
// change. Extend this list (not the form) to expose more.
//
// Header main links → header-nav-v1.
// Footer service / legal / socials links → footer-links-v1.
// Contact emails → footer-contact-v1.
// Remaining groups are labels only (headings, chrome, CTA, cookie copy).
// Cart, checkout handoff, and login live in commerce-copy-fields.ts — not here,
// so they stay out of the Shopify storefront_copy registry.

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
  title: "Header — menu",
  description:
    "Menu control labels in the header and mobile drawer, plus the wordmark second line under SYNARAVA. Cart and account labels are edited under Cart & account.",
  fields: [
    { key: "nav.openMenu", label: "Open menu (aria)" },
    { key: "nav.closeMenu", label: "Close menu (aria)" },
    {
      key: "a11y.skip",
      label: "Skip to main content",
      hint: "Skip link shown on keyboard focus (layout chrome).",
    },
    {
      key: "theme.appearance",
      label: "Appearance",
      hint: "Label above the theme toggle in the mobile menu.",
    },
    {
      key: "brand.curatedGoods",
      label: "Header under logo",
      hint:
        "Second line under SYNARAVA in the header wordmark (also reused in the footer wordmark). Not the footer tagline.",
    },
  ],
};

const FOOTER_BRAND_GROUP: StorefrontCopyGroup = {
  id: "footer-brand",
  title: "Footer — brand",
  description:
    "Footer tagline and copyright. The wordmark second line is edited under Header — menu (Header under logo).",
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

const COOKIE_CONSENT_GROUP: StorefrontCopyGroup = {
  id: "cookies-consent",
  title: "Cookies — banner & preferences",
  description:
    "First-visit banner and the preferences form (modal and /cookie-settings). One set of labels for both.",
  fields: [
    { key: "privacyConsent.eyebrow", label: "Eyebrow" },
    { key: "privacyConsent.title", label: "Banner title" },
    {
      key: "privacyConsent.description",
      label: "Banner description",
      area: true,
      hint: "Body under the banner title, before the privacy-policy link.",
    },
    {
      key: "privacyConsent.policyLink",
      label: "Policy link",
      hint: "Link text after the banner description. Opens /privacy#cookies.",
    },
    { key: "privacyConsent.acceptAll", label: "Accept all" },
    {
      key: "privacyConsent.rejectAll",
      label: "Reject optional",
      hint: "Banner button and the same action on the preferences form.",
    },
    { key: "privacyConsent.customize", label: "Customize" },
    { key: "privacyConsent.preferencesTitle", label: "Preferences title" },
    {
      key: "privacyConsent.preferencesDescription",
      label: "Preferences description",
      area: true,
    },
    { key: "privacyConsent.necessaryTitle", label: "Necessary — title" },
    {
      key: "privacyConsent.necessaryDescription",
      label: "Necessary — description",
      area: true,
    },
    { key: "privacyConsent.preferenceTitle", label: "Preferences — title" },
    {
      key: "privacyConsent.preferenceDescription",
      label: "Preferences — description",
      area: true,
    },
    { key: "privacyConsent.analyticsTitle", label: "Analytics — title" },
    {
      key: "privacyConsent.analyticsDescription",
      label: "Analytics — description",
      area: true,
    },
    { key: "privacyConsent.marketingTitle", label: "Marketing — title" },
    {
      key: "privacyConsent.marketingDescription",
      label: "Marketing — description",
      area: true,
    },
    { key: "privacyConsent.save", label: "Save choices" },
  ],
};

const COOKIE_SETTINGS_PAGE_GROUP: StorefrontCopyGroup = {
  id: "cookies-page",
  title: "Cookies — settings page",
  description:
    "Page-only lines on /cookie-settings: confirmation, back link, and SEO. The preference form is edited above.",
  fields: [
    { key: "cookieSettings.metaTitle", label: "SEO title" },
    {
      key: "cookieSettings.metaDescription",
      label: "SEO description",
      area: true,
    },
    { key: "cookieSettings.saved", label: "Saved confirmation" },
    { key: "cookieSettings.backToPrivacy", label: "Back to Privacy Policy" },
  ],
};

const PLURAL = "Keep {count}. “one” is a single item; “few” and “many” are for languages such as Russian; “other” covers everything else. Leave few/many empty to reuse “other”.";

const HOME_ARCHIVE_GROUP: StorefrontCopyGroup = {
  id: "home-archive",
  title: "Home — featured collections",
  description:
    "UI chrome on the home Featured collections strip (ArchivePathway). The Collection word also drives Collection 01 / 02 eyebrows on the collections index and collection detail hero. Collection titles, notes, and series values stay on each Collection record.",
  fields: [
    {
      key: "home.archive.collectionNote",
      label: "Collection note label",
      hint: "Bracketed label above each collection summary on the home strip (e.g. [COLLECTION NOTE]). Home only.",
    },
    {
      key: "home.archive.viewCollection",
      label: "View collection",
      hint: "Overlay CTA on the home collection image and the PDP “Continue exploring” primary button when the product is linked to a collection.",
    },
    {
      key: "home.archive.collection",
      label: "Collection field label",
      hint: "Meta label on the home strip AND the “Collection 02” eyebrow on /collections and collection detail.",
    },
    {
      key: "home.archive.edition",
      label: "Edition field label",
      hint: "Table / meta label beside the edition value on the home strip. Home only.",
    },
    {
      key: "home.archive.viewCollectionAria",
      label: "View collection (aria)",
      hint: "Accessible name for the home collection card link. Keep {title}.",
    },
  ],
};

const PRODUCT_CONTINUE_EXPLORING_GROUP: StorefrontCopyGroup = {
  id: "product-continue-exploring",
  title: "Product — continue exploring footer",
  description:
    "Bottom CTA band on every product page that belongs to a collection (ProductFooter). Not a CMS block — chrome only. Collection name comes from the linked Collection record; titles/notes stay there.",
  fields: [
    {
      key: "product.continueExploring.partOf",
      label: "Part of collection",
      hint: "Red eyebrow above the heading. Keep {name} for the localized collection title.",
    },
    {
      key: "product.continueExploring.title",
      label: "Continue exploring heading",
    },
    {
      key: "product.continueExploring.backToShop",
      label: "Back to shop link",
    },
    {
      key: "product.continueExploring.archiveGhost",
      label: "Archive watermark",
      hint: "Faint background word behind the heading.",
    },
  ],
};

const HOME_MATERIAL_GROUP: StorefrontCopyGroup = {
  id: "home-material",
  title: "Home — material lexicon chrome",
  description:
    "Overlay labels on MaterialLab plates. Section eyebrow/title/note and lexicon entries are edited under Pages → Home.",
  fields: [
    {
      key: "home.material.specimen",
      label: "Specimen label",
      hint: "Corner label on each plate image. Keep {symbol} (e.g. 01).",
    },
    {
      key: "home.material.label",
      label: "Material index label",
      hint: "Red index line above the material name. Keep {index} (e.g. 01).",
    },
  ],
};

const HOME_FINAL_CTA_GROUP: StorefrontCopyGroup = {
  id: "home-final-cta",
  title: "Home — final CTA chrome",
  description:
    "Eyebrow above the closing CTA. Body, title, and button labels fall back to messages and can be overridden on Pages → Home.",
  fields: [
    {
      key: "home.finalCta.eyebrow",
      label: "Continue the story",
      hint: "Small red eyebrow (e.g. 07 / Continue the story).",
    },
  ],
};

const REVIEW_FORM_GROUP: StorefrontCopyGroup = {
  id: "reviews-form",
  title: "Reviews — leave a review",
  description:
    "The form on a product page. The reviews themselves are Shopify product_review entries and are not edited here. The account table is edited under Customer account.",
  fields: [
    { key: "reviews.shareTitle", label: "Heading" },
    { key: "reviews.ratingLabel", label: "Rating label" },
    { key: "reviews.star.one", label: "Stars — one", hint: PLURAL },
    { key: "reviews.star.few", label: "Stars — few", hint: PLURAL },
    { key: "reviews.star.many", label: "Stars — many", hint: PLURAL },
    { key: "reviews.star.other", label: "Stars — other", hint: PLURAL },
    { key: "reviews.titleLabel", label: "Title label" },
    { key: "reviews.optional", label: "Optional" },
    { key: "reviews.titlePlaceholder", label: "Title placeholder" },
    { key: "reviews.bodyLabel", label: "Review label" },
    { key: "reviews.bodyPlaceholder", label: "Review placeholder" },
    { key: "reviews.publishing", label: "Publishing" },
    { key: "reviews.publish", label: "Publish" },
    { key: "reviews.storedNotice", label: "Stored in Shopify", area: true },
    { key: "reviews.signInBody", label: "Sign-in prompt", area: true },
    { key: "reviews.signInCta", label: "Sign-in link" },
    { key: "reviews.signInAgain", label: "Sign in again" },
    { key: "reviews.form.checkFields", label: "Check fields", area: true },
    { key: "reviews.form.requiresLogin", label: "Needs sign-in", area: true },
    { key: "reviews.form.verifyFailed", label: "Could not verify", area: true },
    { key: "reviews.form.productNotReady", label: "Product not ready", area: true },
    { key: "reviews.form.rateLimited", label: "Too many reviews", area: true },
    { key: "reviews.form.publishFailed", label: "Could not publish", area: true },
    { key: "reviews.form.success", label: "Published", area: true },
    { key: "reviews.form.field.rating", label: "Rating error" },
    { key: "reviews.form.field.title", label: "Title error" },
    { key: "reviews.form.field.body", label: "Review error", area: true },
  ],
};

export const STOREFRONT_COPY_GROUPS: StorefrontCopyGroup[] = [
  HEADER_CHROME_GROUP,
  FOOTER_BRAND_GROUP,
  FOOTER_NAV_GROUP,
  FOOTER_SERVICE_HEADING_GROUP,
  FOOTER_SOCIAL_HEADING_GROUP,
  SERVICE_CONTACT_GROUP,
  HOME_ARCHIVE_GROUP,
  PRODUCT_CONTINUE_EXPLORING_GROUP,
  HOME_MATERIAL_GROUP,
  HOME_FINAL_CTA_GROUP,
  COOKIE_CONSENT_GROUP,
  COOKIE_SETTINGS_PAGE_GROUP,
  REVIEW_FORM_GROUP,
];

export const STOREFRONT_COPY_KEYS: string[] = STOREFRONT_COPY_GROUPS.flatMap(
  (group) => group.fields.map((field) => field.key),
);

/** Keys edited with AdminRichTextField — sanitize on server persist. */
export const STOREFRONT_COPY_RICH_TEXT_KEYS: ReadonlySet<string> = new Set(
  STOREFRONT_COPY_GROUPS.flatMap((group) =>
    group.fields.filter((field) => field.area).map((field) => field.key),
  ),
);

/** Keep a locale map down to the keys this screen actually syncs. */
export function pickStorefrontCopyFields(
  copy: Record<string, string> | null | undefined,
  fieldKeys: readonly string[],
): Record<string, string> {
  if (!copy) return {};
  const allowed = new Set(fieldKeys);
  return Object.fromEntries(
    Object.entries(copy).filter(([key, value]) => allowed.has(key) && value.trim().length > 0),
  );
}
