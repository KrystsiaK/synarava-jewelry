import "server-only";

import { z } from "zod";

import { getShopifyCustomerAccountConfig } from "./config";

export const customerTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  id_token: z.string().min(1).optional(),
  refresh_token: z.string().min(1),
});

export async function requestCustomerTokens(
  tokenEndpoint: string,
  body: URLSearchParams,
) {
  const { appOrigin } = getShopifyCustomerAccountConfig();
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: appOrigin,
      "User-Agent": "Synarava/1.0",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shopify token request failed (${response.status}).`);
  }

  return customerTokenResponseSchema.parse(await response.json());
}
