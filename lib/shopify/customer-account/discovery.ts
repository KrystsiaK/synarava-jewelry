import "server-only";

import { z } from "zod";

import { getShopifyCustomerAccountConfig } from "./config";

const authorizationDiscoverySchema = z.object({
  authorization_endpoint: z.string().url(),
  end_session_endpoint: z.string().url(),
  issuer: z.string().url(),
  jwks_uri: z.string().url(),
  token_endpoint: z.string().url(),
});

const apiDiscoverySchema = z.object({
  graphql_api: z.string().url(),
});

async function discover<T>(url: string, schema: z.ZodType<T>) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Shopify discovery failed (${response.status}).`);
  }

  return schema.parse(await response.json());
}

export function getCustomerAuthorizationDiscovery() {
  const { shopDomain } = getShopifyCustomerAccountConfig();
  return discover(
    `https://${shopDomain}/.well-known/openid-configuration`,
    authorizationDiscoverySchema,
  );
}

export function getCustomerApiDiscovery() {
  const { shopDomain } = getShopifyCustomerAccountConfig();
  return discover(
    `https://${shopDomain}/.well-known/customer-account-api`,
    apiDiscoverySchema,
  );
}
