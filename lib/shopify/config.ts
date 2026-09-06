import "server-only";

import { env } from "@/lib/env";

export const SHOPIFY_STOREFRONT_API_VERSION =
  env.SHOPIFY_STOREFRONT_API_VERSION ?? "2026-07";

/**
 * Whether Shopify Storefront credentials are present. Shopify is the only
 * commerce backend this app supports — this just distinguishes a fully
 * configured deployment from one still missing its store domain/token
 * (e.g. a fresh preview environment), so admin sync actions can fail with a
 * clear message instead of an opaque fetch error.
 */
export function isShopifyConfigured() {
  return Boolean(env.SHOPIFY_STORE_DOMAIN && env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN);
}

export function getShopifyStorefrontConfig() {
  if (!env.SHOPIFY_STORE_DOMAIN || !env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN) {
    throw new Error(
      "Shopify commerce is enabled, but SHOPIFY_STORE_DOMAIN or " +
        "SHOPIFY_STOREFRONT_PRIVATE_TOKEN is missing.",
    );
  }

  return {
    domain: env.SHOPIFY_STORE_DOMAIN,
    privateToken: env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
    apiVersion: SHOPIFY_STOREFRONT_API_VERSION,
    endpoint: `https://${env.SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_STOREFRONT_API_VERSION}/graphql.json`,
  };
}
