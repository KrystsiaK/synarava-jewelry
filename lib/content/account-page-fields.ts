// Storefront customer account page (/profile). Client-safe.
// Stored in SiteSetting `commerce-copy-v1` beside cart and login copy, but
// saved from its own screen. Cart & account only writes its own keys, so the
// two saves do not clear each other. Not synced to Shopify.

import type { StorefrontCopyGroup } from "@/lib/content/storefront-copy-fields";

const COUNT = "Keep {count}. It is filled in on the page.";
const PLURAL = "Keep {count}. “one” is a single item; “few” and “many” are for languages such as Russian; “other” covers everything else. Leave few/many empty to reuse “other”.";

export const ACCOUNT_PAGE_AREAS = [
  { id: "frame", label: "Frame", detail: "Name, sign out, tab labels" },
  { id: "overview", label: "Overview", detail: "Orders, spent, member since" },
  { id: "wishlist", label: "Wishlist", detail: "Saved pieces" },
  { id: "orders", label: "Orders", detail: "History and tracking" },
  { id: "reviews", label: "Reviews", detail: "Reviews this customer published" },
  { id: "addresses", label: "Addresses", detail: "Saved addresses" },
  { id: "security", label: "Sign-in", detail: "Passwordless session" },
  { id: "returns", label: "Returns", detail: "Request a return" },
] as const;

export type AccountPageAreaId = (typeof ACCOUNT_PAGE_AREAS)[number]["id"];

const FRAME: StorefrontCopyGroup = {
  id: "frame",
  title: "Frame",
  description: "The band above the tabs, the tab names, and the page title in the browser.",
  fields: [
    { key: "profile.metaTitle", label: "SEO title" },
    { key: "profile.metaDescription", label: "SEO description", area: true },
    { key: "profile.customerAccount", label: "Eyebrow" },
    { key: "profile.noEmail", label: "Missing email" },
    { key: "profile.signOut", label: "Sign out" },
    { key: "profile.sectionsAriaLabel", label: "Tabs (screen reader)" },
    { key: "profile.tabs.overview", label: "Tab — Overview" },
    { key: "profile.tabs.wishlist", label: "Tab — Wishlist" },
    { key: "profile.tabs.orders", label: "Tab — Orders" },
    { key: "profile.tabs.addresses", label: "Tab — Addresses" },
    { key: "profile.tabs.security", label: "Tab — Sign-in & security" },
  ],
};

const OVERVIEW: StorefrontCopyGroup = {
  id: "overview",
  title: "Overview",
  description: "The three figures and the two buttons on the first tab.",
  fields: [
    { key: "profile.overview.orders", label: "Orders label" },
    { key: "profile.overview.totalSpent", label: "Total spent label" },
    { key: "profile.overview.memberSince", label: "Member since label" },
    { key: "profile.overview.viewOrders", label: "View orders" },
    { key: "profile.overview.currentCart", label: "Current cart" },
  ],
};

const WISHLIST: StorefrontCopyGroup = {
  id: "wishlist",
  title: "Wishlist",
  description: "Saved products. The shop link is also used when order history is empty.",
  fields: [
    { key: "profile.wishlist.title", label: "Title" },
    { key: "profile.wishlist.saved.one", label: "Count — one", hint: PLURAL },
    { key: "profile.wishlist.saved.few", label: "Count — few", hint: PLURAL },
    { key: "profile.wishlist.saved.many", label: "Count — many", hint: PLURAL },
    { key: "profile.wishlist.saved.other", label: "Count — other", hint: PLURAL },
    { key: "profile.wishlist.empty", label: "Empty", area: true },
    { key: "profile.wishlist.exploreShop", label: "Shop link" },
    { key: "profile.wishlist.removeAria", label: "Remove (screen reader)", hint: "Keep {title}. It is the product name." },
  ],
};

const ORDERS: StorefrontCopyGroup = {
  id: "orders",
  title: "Orders",
  description: "Order history. Amounts, dates, and Shopify order names stay as Shopify sends them.",
  fields: [
    { key: "profile.orders.title", label: "Title" },
    { key: "profile.orders.countLabel", label: "Count suffix" },
    { key: "profile.orders.empty", label: "Empty", area: true },
    { key: "profile.orders.qty", label: "Quantity", hint: COUNT },
    { key: "profile.orders.itemsTruncated", label: "More items", area: true, hint: COUNT },
    { key: "profile.orders.shipmentsTruncated", label: "More shipments", area: true },
    { key: "profile.orders.trackPackage", label: "Track package" },
    { key: "profile.orders.estimatedDelivery", label: "Estimated delivery", hint: "Keep {date}." },
    { key: "profile.orders.returnableTruncated", label: "More returnable items", area: true, hint: COUNT },
    { key: "profile.orders.orderDetails", label: "Order details" },
    { key: "profile.orders.loading", label: "Loading more" },
    { key: "profile.orders.loadMore", label: "Load more" },
    { key: "profile.orders.loadMoreFailed", label: "Load more failed", area: true },
    { key: "profile.orders.requiresLogin", label: "Session expired", area: true },
  ],
};

const REVIEWS: StorefrontCopyGroup = {
  id: "reviews",
  title: "Reviews",
  description: "The customer’s own Shopify product reviews. The text, rating, and reply come from Shopify. The form for leaving a review is edited under Shared.",
  fields: [
    { key: "profile.tabs.reviews", label: "Tab — Reviews" },
    { key: "profile.reviews.title", label: "Title" },
    { key: "profile.reviews.empty", label: "Empty", area: true },
    { key: "profile.reviews.colProduct", label: "Column — product" },
    { key: "profile.reviews.colRating", label: "Column — rating" },
    { key: "profile.reviews.colDate", label: "Column — date" },
    { key: "profile.reviews.colReview", label: "Column — review" },
    { key: "profile.reviews.ratingOnly", label: "Rating only" },
    { key: "profile.reviews.close", label: "Close" },
    { key: "profile.reviews.verified", label: "Verified buyer" },
    { key: "profile.reviews.reply", label: "Merchant reply" },
    { key: "profile.reviews.missingProduct", label: "Missing product" },
    { key: "profile.reviews.openProduct", label: "Open product" },
  ],
};

const ADDRESSES: StorefrontCopyGroup = {
  id: "addresses",
  title: "Addresses",
  description: "Saved addresses. The address lines themselves come from Shopify.",
  fields: [
    { key: "profile.addresses.title", label: "Title" },
    { key: "profile.addresses.showingFirst", label: "Showing first", hint: COUNT },
    { key: "profile.addresses.empty", label: "Empty", area: true },
    { key: "profile.addresses.default", label: "Default" },
  ],
};

const SECURITY: StorefrontCopyGroup = {
  id: "security",
  title: "Sign-in & security",
  description: "Explains that sign-in is a Shopify email code. There is no password field to edit.",
  fields: [
    { key: "profile.security.eyebrow", label: "Eyebrow" },
    { key: "profile.security.title", label: "Title" },
    { key: "profile.security.body", label: "Body", area: true },
    { key: "profile.security.signOutDevice", label: "Sign out on this device" },
    { key: "profile.security.renewsNextSignIn", label: "Session renews next sign-in", area: true },
    { key: "profile.security.expiresInOneDay", label: "Expires in one day", area: true },
    { key: "profile.security.expiresInDays", label: "Expires in days", area: true, hint: "Keep {days}." },
  ],
};

const RETURNS: StorefrontCopyGroup = {
  id: "returns",
  title: "Returns",
  description: "The return request on an order. Shopify’s own rejection text is shown as-is when it sends one.",
  fields: [
    { key: "profile.returns.request", label: "Open" },
    { key: "profile.returns.quantityAria", label: "Quantity (screen reader)", hint: "Keep {name}. It is the line item." },
    { key: "profile.returns.submitting", label: "Submitting" },
    { key: "profile.returns.submit", label: "Submit" },
    { key: "profile.returns.cancel", label: "Cancel" },
    { key: "profile.returns.success", label: "Success", area: true },
    { key: "profile.returns.genericFailed", label: "Failed", area: true },
    { key: "profile.returns.rateLimited", label: "Too many requests", area: true },
    { key: "profile.returns.selectAtLeastOne", label: "Nothing selected", area: true },
  ],
};

export const ACCOUNT_PAGE_GROUPS: StorefrontCopyGroup[] = [
  FRAME,
  OVERVIEW,
  WISHLIST,
  ORDERS,
  REVIEWS,
  ADDRESSES,
  SECURITY,
  RETURNS,
];

export const ACCOUNT_PAGE_KEYS: string[] = ACCOUNT_PAGE_GROUPS.flatMap((group) =>
  group.fields.map((field) => field.key),
);

export function accountPageAreaForHash(hash: string): AccountPageAreaId | null {
  const id = hash.replace(/^#/, "").replace(/^account-/, "");
  return ACCOUNT_PAGE_AREAS.some((area) => area.id === id) ? id as AccountPageAreaId : null;
}
