// Cart, checkout handoff, and customer login copy.
// Client-safe (no database). Stored in SiteSetting `commerce-copy-v1`.
//
// These strings are rendered by the headless storefront. Shopify hosts the
// checkout form, payment, and the customer-account code screen, so this set
// is intentionally absent from STOREFRONT_COPY_FIELD_REGISTRY and is not
// pushed to the `$app:storefront_copy` metaobject.

import type { StorefrontCopyGroup } from "@/lib/content/storefront-copy-fields";

export const COMMERCE_COPY_KEY = "commerce-copy-v1";

export type LocaleCopy = Record<string, Record<string, string>>;

/**
 * Header cart/account labels used to live in `storefront-copy-v1`.
 * The editor still shows a saved value from there until Cart & account is saved,
 * which copies it here and clears the old key so Shared sync stops carrying it.
 */
export const MOVED_HEADER_ACCOUNT_KEYS = [
  "nav.cart",
  "nav.login",
  "nav.account",
  "nav.loginRegister",
] as const;

const COUNT_HINT = "Keep {count}. “one” is a single item; “few” and “many” are for languages such as Russian; “other” covers everything else. Leave few/many empty to reuse “other”.";

const ENTRY_GROUP: StorefrontCopyGroup = {
  id: "entry",
  title: "Header — cart & account",
  description: "Cart and account labels in the header and the mobile menu. Menu open/close stays in Shared.",
  fields: [
    { key: "nav.cart", label: "Cart" },
    {
      key: "nav.cartWithCount.one",
      label: "Cart with count — one (aria)",
      hint: COUNT_HINT,
    },
    {
      key: "nav.cartWithCount.few",
      label: "Cart with count — few (aria)",
      hint: COUNT_HINT,
    },
    {
      key: "nav.cartWithCount.many",
      label: "Cart with count — many (aria)",
      hint: COUNT_HINT,
    },
    {
      key: "nav.cartWithCount.other",
      label: "Cart with count — other (aria)",
      hint: COUNT_HINT,
    },
    { key: "nav.login", label: "Login" },
    { key: "nav.account", label: "My Account" },
    { key: "nav.loginRegister", label: "Login / Register" },
  ],
};

const CART_GROUP: StorefrontCopyGroup = {
  id: "cart",
  title: "Cart",
  description:
    "The /cart page. The checkout button leaves this site for Shopify. Address, shipping rates, and payment are not edited here.",
  fields: [
    { key: "cart.metaTitle", label: "SEO title" },
    { key: "cart.metaDescription", label: "SEO description", area: true },
    { key: "cart.eyebrow", label: "Eyebrow" },
    { key: "cart.titleLead", label: "Title — lead" },
    { key: "cart.titleAccent", label: "Title — accent" },
    { key: "cart.description", label: "Intro", area: true },
    { key: "cart.backToAccount", label: "Back to account" },
    { key: "cart.emptyTitleLead", label: "Empty — lead" },
    { key: "cart.emptyTitleAccent", label: "Empty — accent" },
    { key: "cart.emptyBody", label: "Empty — body", area: true },
    { key: "cart.browse", label: "Empty — button" },
    { key: "cart.summary", label: "Summary heading" },
    { key: "cart.itemCount.one", label: "Item count — one", hint: COUNT_HINT },
    { key: "cart.itemCount.few", label: "Item count — few", hint: COUNT_HINT },
    { key: "cart.itemCount.many", label: "Item count — many", hint: COUNT_HINT },
    { key: "cart.itemCount.other", label: "Item count — other", hint: COUNT_HINT },
    { key: "cart.subtotal", label: "Subtotal" },
    { key: "cart.each", label: "Unit price suffix" },
    { key: "cart.decrease", label: "Decrease quantity (aria)" },
    { key: "cart.increase", label: "Increase quantity (aria)" },
    { key: "cart.stockLimit", label: "Stock limit tooltip" },
    { key: "cart.remove", label: "Remove" },
    { key: "cart.secureCheckout", label: "Checkout button" },
    {
      key: "cart.shopifyNote",
      label: "Checkout note",
      area: true,
      hint: "Shown under the checkout button. Delivery and payment happen on Shopify.",
    },
    { key: "cart.continueShopping", label: "Continue shopping" },
  ],
};

const CHECKOUT_GROUP: StorefrontCopyGroup = {
  id: "checkout",
  title: "Add to cart & checkout",
  description:
    "The button on the product page and the confirmation that offers View cart and Checkout. Both checkout links open Shopify.",
  fields: [
    { key: "product.add", label: "Add to cart" },
    { key: "product.adding", label: "Adding…" },
    { key: "product.added", label: "Added (status)" },
    { key: "product.addedTitle", label: "Confirmation title" },
    { key: "product.cartCount.one", label: "Cart count — one", hint: COUNT_HINT },
    { key: "product.cartCount.few", label: "Cart count — few", hint: COUNT_HINT },
    { key: "product.cartCount.many", label: "Cart count — many", hint: COUNT_HINT },
    { key: "product.cartCount.other", label: "Cart count — other", hint: COUNT_HINT },
    { key: "product.viewCart", label: "View cart" },
    { key: "product.checkout", label: "Checkout" },
    { key: "product.closeConfirmation", label: "Close confirmation (aria)" },
    { key: "product.addFailedTitle", label: "Error title" },
    { key: "product.addFailed", label: "Error body" },
    { key: "product.tryAgain", label: "Try again" },
  ],
};

const LOGIN_GROUP: StorefrontCopyGroup = {
  id: "login",
  title: "Login",
  description:
    "The /login page before Shopify Customer Account. Sign-in is a one-time email code on Shopify. There is no password form on this page.",
  fields: [
    { key: "loginPage.metaTitle", label: "SEO title" },
    { key: "loginPage.metaDescription", label: "SEO description", area: true },
    { key: "loginPage.eyebrow", label: "Eyebrow" },
    { key: "loginPage.title", label: "Title" },
    { key: "loginPage.description", label: "Description", area: true },
    { key: "loginPage.asideTitle", label: "Aside title" },
    { key: "loginPage.asideBody", label: "Aside body", area: true },
    { key: "loginPage.panelEyebrow", label: "Panel eyebrow" },
    { key: "loginPage.panelTitle", label: "Panel title" },
    { key: "loginPage.submit", label: "Sign-in button" },
    { key: "loginPage.note", label: "Note under the button", area: true },
    { key: "loginPage.error", label: "Sign-in error", area: true },
    { key: "loginPage.backToSite", label: "Back to site" },
  ],
};

export const COMMERCE_COPY_GROUPS: StorefrontCopyGroup[] = [
  ENTRY_GROUP,
  CART_GROUP,
  CHECKOUT_GROUP,
  LOGIN_GROUP,
];

export const COMMERCE_COPY_KEYS: string[] = COMMERCE_COPY_GROUPS.flatMap((group) =>
  group.fields.map((field) => field.key),
);

export function overlayLegacyHeaderLabels(commerce: LocaleCopy, shared: LocaleCopy): LocaleCopy {
  const locales = new Set([...Object.keys(commerce), ...Object.keys(shared)]);
  const next: LocaleCopy = {};
  for (const locale of locales) {
    const legacy: Record<string, string> = {};
    for (const key of MOVED_HEADER_ACCOUNT_KEYS) {
      const value = shared[locale]?.[key];
      if (value && !commerce[locale]?.[key]) legacy[key] = value;
    }
    const fields = { ...legacy, ...(commerce[locale] ?? {}) };
    if (Object.keys(fields).length > 0) next[locale] = fields;
  }
  return next;
}
