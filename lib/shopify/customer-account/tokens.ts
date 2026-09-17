import "server-only";

import { z } from "zod";

import { getShopifyCustomerAccountConfig } from "./config";

export const customerTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  id_token: z.string().min(1).optional(),
  refresh_token: z.string().min(1),
});

// `status: null` means the request never got an HTTP response at all (network
// failure) — always transient. A 4xx status means Shopify itself rejected the
// grant (e.g. invalid_grant for a revoked/expired refresh token) — terminal.
// Anything else (5xx) is Shopify's own trouble, also transient. Session
// refresh (REV-17) relies on this distinction to avoid deleting a session over
// a passing outage.
export class ShopifyCustomerTokenError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = "ShopifyCustomerTokenError";
  }
}

export function isTerminalCustomerTokenError(error: unknown): boolean {
  return error instanceof ShopifyCustomerTokenError
    && error.status != null
    && error.status >= 400
    && error.status < 500;
}

export async function requestCustomerTokens(
  tokenEndpoint: string,
  body: URLSearchParams,
) {
  const { appOrigin } = getShopifyCustomerAccountConfig();
  let response: Response;
  try {
    response = await fetch(tokenEndpoint, {
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
  } catch (error) {
    throw new ShopifyCustomerTokenError(
      error instanceof Error ? `Unable to reach Shopify: ${error.message}` : "Unable to reach Shopify.",
      null,
    );
  }

  if (!response.ok) {
    throw new ShopifyCustomerTokenError(`Shopify token request failed (${response.status}).`, response.status);
  }

  return customerTokenResponseSchema.parse(await response.json());
}
