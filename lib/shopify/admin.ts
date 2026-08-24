import "server-only";

import { env } from "@/lib/env";

type GraphQLError = { message: string; path?: Array<string | number> };
type AdminResponse<T> = { data?: T; errors?: GraphQLError[] };
type AccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type CachedAccessToken = {
  value: string;
  refreshAt: number;
};

let cachedAccessToken: CachedAccessToken | null = null;
let accessTokenRequest: Promise<string> | null = null;

export class ShopifyAdminError extends Error {
  constructor(message: string, readonly details?: GraphQLError[]) {
    super(message);
    this.name = "ShopifyAdminError";
  }
}

export function hasShopifyAdminConfig() {
  return Boolean(
    env.SHOPIFY_STORE_DOMAIN &&
      (env.SHOPIFY_ADMIN_ACCESS_TOKEN || (env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET)),
  );
}

export function getShopifyAdminConfig() {
  const hasClientCredentials = Boolean(env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET);
  if (!env.SHOPIFY_STORE_DOMAIN || (!env.SHOPIFY_ADMIN_ACCESS_TOKEN && !hasClientCredentials)) {
    throw new ShopifyAdminError(
      "Shopify Admin API is not configured. Add SHOPIFY_STORE_DOMAIN and either SHOPIFY_CLIENT_ID plus SHOPIFY_CLIENT_SECRET, or SHOPIFY_ADMIN_ACCESS_TOKEN.",
    );
  }

  const apiVersion = env.SHOPIFY_ADMIN_API_VERSION ?? "2026-07";
  return {
    domain: env.SHOPIFY_STORE_DOMAIN,
    apiVersion,
    endpoint: `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${apiVersion}/graphql.json`,
    tokenEndpoint: `https://${env.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`,
    staticToken: env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    clientId: env.SHOPIFY_CLIENT_ID,
    clientSecret: env.SHOPIFY_CLIENT_SECRET,
  };
}

async function requestClientCredentialsToken() {
  const config = getShopifyAdminConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new ShopifyAdminError("Shopify client credentials are incomplete.");
  }

  let response: Response;
  try {
    response = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      cache: "no-store",
    });
  } catch (error) {
    throw new ShopifyAdminError(
      error instanceof Error
        ? `Unable to authenticate with Shopify: ${error.message}`
        : "Unable to authenticate with Shopify.",
    );
  }

  const payload = (await response.json().catch(() => ({}))) as AccessTokenResponse;
  if (!response.ok || !payload.access_token) {
    const reason = payload.error_description ?? payload.error;
    throw new ShopifyAdminError(
      `Shopify token endpoint returned ${response.status} ${response.statusText}${reason ? `: ${reason}` : "."}`,
    );
  }

  const expiresIn = Math.max(1, payload.expires_in ?? 86_399);
  const refreshBuffer = Math.min(300, Math.max(1, Math.floor(expiresIn / 10)));
  cachedAccessToken = {
    value: payload.access_token,
    refreshAt: Date.now() + Math.max(1, expiresIn - refreshBuffer) * 1_000,
  };
  return payload.access_token;
}

async function getShopifyAdminAccessToken(forceRefresh = false) {
  const config = getShopifyAdminConfig();
  const usesClientCredentials = Boolean(config.clientId && config.clientSecret);
  if (!usesClientCredentials && config.staticToken) return config.staticToken;

  if (!forceRefresh && cachedAccessToken && cachedAccessToken.refreshAt > Date.now()) {
    return cachedAccessToken.value;
  }

  if (!accessTokenRequest) {
    accessTokenRequest = requestClientCredentialsToken().finally(() => {
      accessTokenRequest = null;
    });
  }
  return accessTokenRequest;
}

async function sendAdminRequest(
  endpoint: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
}

export async function shopifyAdminRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const config = getShopifyAdminConfig();
  let response: Response;

  try {
    const token = await getShopifyAdminAccessToken();
    response = await sendAdminRequest(config.endpoint, token, query, variables);

    if (response.status === 401 && config.clientId && config.clientSecret) {
      cachedAccessToken = null;
      const refreshedToken = await getShopifyAdminAccessToken(true);
      response = await sendAdminRequest(config.endpoint, refreshedToken, query, variables);
    }
  } catch (error) {
    if (error instanceof ShopifyAdminError) throw error;
    throw new ShopifyAdminError(
      error instanceof Error ? `Unable to reach Shopify: ${error.message}` : "Unable to reach Shopify.",
    );
  }

  if (!response.ok) {
    throw new ShopifyAdminError(`Shopify Admin API returned ${response.status} ${response.statusText}.`);
  }

  const payload = (await response.json()) as AdminResponse<T>;
  if (payload.errors?.length) {
    throw new ShopifyAdminError(payload.errors.map((error) => error.message).join("; "), payload.errors);
  }
  if (!payload.data) throw new ShopifyAdminError("Shopify Admin API returned no data.");
  return payload.data;
}

const REQUIRED_SYNC_SCOPES = ["write_products", "write_inventory", "write_publications"] as const;

export async function testShopifyAdminConnection() {
  const data = await shopifyAdminRequest<{
    shop: { name: string; myshopifyDomain: string };
    productsCount: { count: number; precision: string };
    locations: { nodes: Array<{ id: string }> };
    publications: { nodes: Array<{ id: string; name: string }> };
    currentAppInstallation: { accessScopes: Array<{ handle: string }> };
  }>(`query SynaravaConnectionCheck {
    shop { name myshopifyDomain }
    productsCount(limit: null) { count precision }
    locations(first: 10) { nodes { id } }
    publications(first: 100) { nodes { id name } }
    currentAppInstallation { accessScopes { handle } }
  }`);

  const grantedScopes = data.currentAppInstallation.accessScopes
    .map((scope) => scope.handle)
    .sort();
  const missingScopes = REQUIRED_SYNC_SCOPES.filter((scope) => !grantedScopes.includes(scope));

  return {
    shopName: data.shop.name,
    shopDomain: data.shop.myshopifyDomain,
    productCount: data.productsCount.count,
    productCountPrecision: data.productsCount.precision,
    locations: data.locations.nodes,
    publications: data.publications.nodes,
    grantedScopes,
    missingScopes,
  };
}

export function shopifyNumericId(id: string | number) {
  return shopifyGid("Product", id);
}

export function shopifyGid(resource: string, id: string | number) {
  return String(id).startsWith("gid://") ? String(id) : `gid://shopify/${resource}/${id}`;
}
