import "server-only";

import { getShopifyStorefrontConfig } from "@/lib/shopify/config";

type StorefrontGraphQLError = {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
};

type StorefrontResponse<T> = {
  data?: T;
  errors?: StorefrontGraphQLError[];
};

type StorefrontRequestOptions = {
  buyerIp?: string | null;
  cache?: RequestCache;
  tags?: string[];
};

export class ShopifyStorefrontError extends Error {
  constructor(
    message: string,
    readonly details?: StorefrontGraphQLError[],
  ) {
    super(message);
    this.name = "ShopifyStorefrontError";
  }
}

export async function shopifyStorefrontRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: StorefrontRequestOptions = {},
): Promise<T> {
  const config = getShopifyStorefrontConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Shopify-Storefront-Private-Token": config.privateToken,
  };

  if (options.buyerIp) {
    headers["Shopify-Storefront-Buyer-IP"] = options.buyerIp;
  }

  let response: Response;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      cache: options.cache ?? "no-store",
      next: options.tags?.length ? { tags: options.tags } : undefined,
    });
  } catch (error) {
    throw new ShopifyStorefrontError(
      error instanceof Error
        ? `Unable to reach Shopify: ${error.message}`
        : "Unable to reach Shopify.",
    );
  }

  if (!response.ok) {
    throw new ShopifyStorefrontError(
      `Shopify Storefront API returned ${response.status} ${response.statusText}.`,
    );
  }

  const payload = (await response.json()) as StorefrontResponse<T>;
  if (payload.errors?.length) {
    throw new ShopifyStorefrontError(
      payload.errors.map((error) => error.message).join("; "),
      payload.errors,
    );
  }

  if (!payload.data) {
    throw new ShopifyStorefrontError("Shopify Storefront API returned no data.");
  }

  return payload.data;
}
