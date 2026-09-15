import "server-only";

import { env } from "@/lib/env";
import { normalizeLocale, type Locale } from "@/lib/i18n/locales";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

export const SHOPIFY_CUSTOMER_SESSION_COOKIE =
  "synarava-shopify-customer-session";
export const SHOPIFY_CUSTOMER_OAUTH_COOKIE = "synarava-shopify-customer-oauth";

/**
 * Absolute lifetime of a Synarava customer session, independent of the
 * Shopify access token's own (much shorter) expiry. Shared by the session
 * cookie and the `ShopifyCustomerSession.sessionExpiresAt` record so the two
 * can never drift apart. Refreshing the Shopify access token never extends
 * this value.
 */
export const CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * A session with no activity for this long is treated as abandoned even if
 * its absolute TTL has not elapsed yet.
 */
export const CUSTOMER_SESSION_IDLE_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000;

export function getShopifyCustomerAccountConfig() {
  const appUrl = env.APP_URL ?? env.NEXTAUTH_URL;

  if (
    !env.SHOPIFY_STORE_DOMAIN ||
    !env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID ||
    !env.SHOPIFY_CUSTOMER_SESSION_SECRET ||
    !appUrl
  ) {
    throw new Error(
      "Shopify customer accounts require SHOPIFY_STORE_DOMAIN, " +
        "SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID, " +
        "SHOPIFY_CUSTOMER_SESSION_SECRET, and APP_URL.",
    );
  }

  const origin = new URL(appUrl).origin;

  return {
    appOrigin: origin,
    callbackUrl: `${origin}/api/auth/shopify/callback`,
    clientId: env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID,
    sessionSecret: env.SHOPIFY_CUSTOMER_SESSION_SECRET,
    shopDomain: env.SHOPIFY_STORE_DOMAIN,
  };
}

export function safeCustomerReturnPath(
  value: string | null | undefined,
  fallbackLocale: Locale | string = "en",
) {
  return safeRedirectPath(value, `/${normalizeLocale(fallbackLocale)}/profile`);
}
