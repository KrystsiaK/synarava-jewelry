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
  { id: "orders", label: "Orders", detail: "History, status chips, and actions" },
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
  description: "Order history. Amounts, dates, and Shopify order names stay as Shopify sends them. Status chip labels map Shopify enums.",
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
    { key: "profile.orders.orderDetails", label: "Manage order (legacy key)" },
    { key: "profile.orders.manageOrder", label: "Manage order in secure account" },
    { key: "profile.orders.manageOrderHint", label: "Manage order hint", area: true },
    { key: "profile.orders.cancelRequestHint", label: "Cancel request hint", area: true },
    { key: "profile.orders.payNowHint", label: "Pay now hint", area: true },
    { key: "profile.orders.buyAgainFrozenHint", label: "Buy again unavailable hint", area: true },
    { key: "profile.orders.actions.cancelRequest", label: "Action — request cancellation" },
    { key: "profile.orders.actions.payNow", label: "Action — pay now" },
    { key: "profile.orders.actions.buyAgain", label: "Action — buy again" },
    { key: "profile.orders.actions.buyAgainUnavailable", label: "Action — buy again unavailable" },
    { key: "profile.orders.loading", label: "Loading more" },
    { key: "profile.orders.loadMore", label: "Load more" },
    { key: "profile.orders.loadMoreFailed", label: "Load more failed", area: true },
    { key: "profile.orders.requiresLogin", label: "Session expired", area: true },
    // Payment status chips (OrderFinancialStatus)
    { key: "profile.orders.status.payment.AUTHORIZED", label: "Payment — Authorized" },
    { key: "profile.orders.status.payment.EXPIRED", label: "Payment — Expired" },
    { key: "profile.orders.status.payment.PAID", label: "Payment — Paid" },
    { key: "profile.orders.status.payment.PARTIALLY_PAID", label: "Payment — Partially paid" },
    { key: "profile.orders.status.payment.PARTIALLY_REFUNDED", label: "Payment — Partially refunded" },
    { key: "profile.orders.status.payment.PENDING", label: "Payment — Pending" },
    { key: "profile.orders.status.payment.REFUNDED", label: "Payment — Refunded" },
    { key: "profile.orders.status.payment.VOIDED", label: "Payment — Voided" },
    { key: "profile.orders.status.payment.UNKNOWN", label: "Payment — Unknown" },
    { key: "profile.orders.status.refundedAmount", label: "Refund — amount recorded" },
    // Fulfillment status chips
    { key: "profile.orders.status.fulfillment.FULFILLED", label: "Fulfillment — Fulfilled" },
    { key: "profile.orders.status.fulfillment.IN_PROGRESS", label: "Fulfillment — In progress" },
    { key: "profile.orders.status.fulfillment.ON_HOLD", label: "Fulfillment — On hold" },
    { key: "profile.orders.status.fulfillment.OPEN", label: "Fulfillment — Open" },
    { key: "profile.orders.status.fulfillment.PARTIALLY_FULFILLED", label: "Fulfillment — Partially fulfilled" },
    { key: "profile.orders.status.fulfillment.PENDING_FULFILLMENT", label: "Fulfillment — Pending fulfillment" },
    { key: "profile.orders.status.fulfillment.RESTOCKED", label: "Fulfillment — Restocked" },
    { key: "profile.orders.status.fulfillment.SCHEDULED", label: "Fulfillment — Scheduled" },
    { key: "profile.orders.status.fulfillment.UNFULFILLED", label: "Fulfillment — Unfulfilled" },
    { key: "profile.orders.status.fulfillment.UNKNOWN", label: "Fulfillment — Unknown" },
    // Cancel
    { key: "profile.orders.status.cancelled", label: "Cancelled" },
    { key: "profile.orders.cancelReason.CUSTOMER", label: "Cancel reason — Customer" },
    { key: "profile.orders.cancelReason.DECLINED", label: "Cancel reason — Declined" },
    { key: "profile.orders.cancelReason.FRAUD", label: "Cancel reason — Fraud" },
    { key: "profile.orders.cancelReason.INVENTORY", label: "Cancel reason — Inventory" },
    { key: "profile.orders.cancelReason.OTHER", label: "Cancel reason — Other" },
    { key: "profile.orders.cancelReason.STAFF", label: "Cancel reason — Staff" },
    // Return statuses
    { key: "profile.orders.status.return.REQUESTED", label: "Return — Requested" },
    { key: "profile.orders.status.return.OPEN", label: "Return — In progress" },
    { key: "profile.orders.status.return.CLOSED", label: "Return — Closed" },
    { key: "profile.orders.status.return.DECLINED", label: "Return — Declined" },
    { key: "profile.orders.status.return.CANCELED", label: "Return — Canceled" },
    { key: "profile.orders.status.return.UNKNOWN", label: "Return — Unknown" },
    // Shipment statuses
    { key: "profile.orders.status.shipment.ATTEMPTED_DELIVERY", label: "Shipment — Attempted delivery" },
    { key: "profile.orders.status.shipment.CONFIRMED", label: "Shipment — Confirmed" },
    { key: "profile.orders.status.shipment.DELIVERED", label: "Shipment — Delivered" },
    { key: "profile.orders.status.shipment.FAILURE", label: "Shipment — Failure" },
    { key: "profile.orders.status.shipment.IN_TRANSIT", label: "Shipment — In transit" },
    { key: "profile.orders.status.shipment.LABEL_PRINTED", label: "Shipment — Label printed" },
    { key: "profile.orders.status.shipment.LABEL_PURCHASED", label: "Shipment — Label purchased" },
    { key: "profile.orders.status.shipment.OUT_FOR_DELIVERY", label: "Shipment — Out for delivery" },
    { key: "profile.orders.status.shipment.READY_FOR_PICKUP", label: "Shipment — Ready for pickup" },
    { key: "profile.orders.status.shipment.SUBMITTED", label: "Shipment — Submitted" },
    { key: "profile.orders.status.shipment.UNKNOWN", label: "Shipment — Unknown" },
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

/** Keys edited with AdminRichTextField — sanitize on server persist. */
export const ACCOUNT_PAGE_RICH_TEXT_KEYS: ReadonlySet<string> = new Set(
  ACCOUNT_PAGE_GROUPS.flatMap((group) =>
    group.fields.filter((field) => field.area).map((field) => field.key),
  ),
);

export function accountPageAreaForHash(hash: string): AccountPageAreaId | null {
  const id = hash.replace(/^#/, "").replace(/^account-/, "");
  return ACCOUNT_PAGE_AREAS.some((area) => area.id === id) ? id as AccountPageAreaId : null;
}
