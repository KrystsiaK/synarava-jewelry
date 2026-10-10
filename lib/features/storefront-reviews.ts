/**
 * TEMPORARY storefront kill-switch for buyer-facing reviews / comments.
 *
 * When `false`:
 * - PDP review section + hero rating link are not rendered
 * - Account “Reviews” tab is hidden (deep links fall back to overview)
 * - Product JSON-LD omits aggregateRating / review nodes
 *
 * Flip to `true` to restore. Do **not** delete `components/reviews/*`,
 * `AccountReviews`, or Shopify review sync — we will turn this back on.
 */
export const STOREFRONT_REVIEWS_VISIBLE = false;

export function storefrontReviewsVisible(): boolean {
  return STOREFRONT_REVIEWS_VISIBLE;
}
