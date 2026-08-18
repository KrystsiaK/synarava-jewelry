import "server-only";

import { env } from "@/lib/env";

export const SHOPIFY_STOREFRONT_API_VERSION =
  env.SHOPIFY_STOREFRONT_API_VERSION ?? "2026-07";

export function isShopifyCommerceEnabled() {
  return env.COMMERCE_BACKEND === "shopify";
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
