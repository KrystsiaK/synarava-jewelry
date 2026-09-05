import "server-only";

import { env } from "@/lib/env";
import { normalizeLocale, type Locale } from "@/lib/i18n/locales";

export const SHOPIFY_CUSTOMER_SESSION_COOKIE =
  "synarava-shopify-customer-session";
export const SHOPIFY_CUSTOMER_OAUTH_COOKIE = "synarava-shopify-customer-oauth";

export function getShopifyCustomerAccountConfig() {
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? env.NEXTAUTH_URL;

  if (
    !env.SHOPIFY_STORE_DOMAIN ||
    !env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID ||
    !env.SHOPIFY_CUSTOMER_SESSION_SECRET ||
    !appUrl
  ) {
    throw new Error(
      "Shopify customer accounts require SHOPIFY_STORE_DOMAIN, " +
        "SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID, " +
        "SHOPIFY_CUSTOMER_SESSION_SECRET, and NEXT_PUBLIC_APP_URL.",
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
  const fallback = `/${normalizeLocale(fallbackLocale)}/profile`;

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://synarava.invalid");
    return url.origin === "https://synarava.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
