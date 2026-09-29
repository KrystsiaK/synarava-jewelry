import "server-only";

/**
 * Append Shopify headless checkout silent SSO.
 * Official contract: append `sso=silent` to Cart API `checkoutUrl` so Checkout
 * authenticates via the buyer's Customer Accounts browser session.
 * @see https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/checkout-authentication
 * @see https://shopify.dev/changelog/posts/headless-checkout-sso-is-now-documented-with-ssosilent
 */
export function withCheckoutSsoSilent(checkoutUrl: string): string {
  const url = new URL(checkoutUrl);
  if (url.searchParams.get("sso") !== "silent") {
    url.searchParams.set("sso", "silent");
  }
  return url.toString();
}
