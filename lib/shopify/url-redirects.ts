import "server-only";

import { env } from "@/lib/env";
import {
  hasShopifyAdminConfig,
  ShopifyAdminError,
  shopifyAdminRequest,
} from "@/lib/shopify/admin";

/** Shopify Admin GraphQL `UrlRedirect` row — Online Store host only. */
export type ShopifyUrlRedirect = {
  id: string;
  path: string;
  target: string;
};

export type ShopifyUrlRedirectsResult =
  | {
      status: "ok";
      shopDomain: string;
      adminRedirectsUrl: string;
      count: number;
      countPrecision: string;
      redirects: ShopifyUrlRedirect[];
      truncated: boolean;
    }
  | {
      status: "unconfigured";
    }
  | {
      status: "missing_scope";
      shopDomain: string;
      adminRedirectsUrl: string;
      requiredScope: "read_online_store_navigation";
      message: string;
    }
  | {
      status: "error";
      shopDomain: string | null;
      adminRedirectsUrl: string | null;
      message: string;
    };

const SAMPLE_LIMIT = 40;

/** Docs: https://shopify.dev/docs/api/admin-graphql/latest/objects/UrlRedirect */
export const SHOPIFY_URL_REDIRECT_READ_SCOPE = "read_online_store_navigation" as const;

function shopifyAdminRedirectsUrl(shopDomain: string) {
  const handle = shopDomain.replace(/\.myshopify\.com$/i, "");
  return `https://admin.shopify.com/store/${handle}/content/redirects`;
}

function isAccessDenied(error: unknown) {
  if (!(error instanceof ShopifyAdminError)) return false;
  const haystack = `${error.message} ${(error.details ?? []).map((d) => d.message).join(" ")}`.toLowerCase();
  return (
    haystack.includes("access denied")
    || haystack.includes("access_denied")
    || haystack.includes(SHOPIFY_URL_REDIRECT_READ_SCOPE)
    || haystack.includes("online_store_navigation")
  );
}

/**
 * Read-only mirror of Shopify URL Redirects for /admin/meta.
 * Does not create or edit redirects — Shopify remains SoT
 * (https://shopify.dev/docs/api/admin-graphql/latest/queries/urlRedirects).
 */
export async function fetchShopifyUrlRedirects(
  limit = SAMPLE_LIMIT,
): Promise<ShopifyUrlRedirectsResult> {
  if (!hasShopifyAdminConfig()) {
    return { status: "unconfigured" };
  }

  const shopDomain = env.SHOPIFY_STORE_DOMAIN!;
  const adminRedirectsUrl = shopifyAdminRedirectsUrl(shopDomain);

  try {
    const data = await shopifyAdminRequest<{
      urlRedirectsCount: { count: number; precision: string };
      urlRedirects: { nodes: ShopifyUrlRedirect[] };
    }>(
      `query SynaravaUrlRedirects($first: Int!) {
        urlRedirectsCount(limit: null) { count precision }
        urlRedirects(first: $first, sortKey: PATH) {
          nodes { id path target }
        }
      }`,
      { first: limit },
    );

    const redirects = data.urlRedirects.nodes ?? [];
    const count = data.urlRedirectsCount?.count ?? redirects.length;
    return {
      status: "ok",
      shopDomain,
      adminRedirectsUrl,
      count,
      countPrecision: data.urlRedirectsCount?.precision ?? "EXACT",
      redirects,
      truncated: count > redirects.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Shopify URL Redirects.";
    if (isAccessDenied(error)) {
      return {
        status: "missing_scope",
        shopDomain,
        adminRedirectsUrl,
        requiredScope: SHOPIFY_URL_REDIRECT_READ_SCOPE,
        message,
      };
    }
    return { status: "error", shopDomain, adminRedirectsUrl, message };
  }
}
