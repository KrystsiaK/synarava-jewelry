import "server-only";

import { env } from "@/lib/env";
import { listStorefrontLocales } from "@/lib/i18n/storefront-locale-registry";
import {
  SHOPIFY_RATE_LIMIT_USER_MESSAGE,
  SHOPIFY_THROTTLE_MAX_ATTEMPTS,
  SHOPIFY_THROTTLE_MAX_TOTAL_WAIT_MS,
  computeThrottleWaitMs,
  hasThrottleBudgetShortfall,
  isExplicitThrottledError,
  isGraphqlMutation,
  isIdempotentGraphqlMutation,
  logShopifyAdminRequest,
  parseShopifyQueryCost,
  sanitizeGraphqlOperationName,
  type ShopifyQueryCost,
  type ShopifyThrottleStatus,
} from "@/lib/shopify/admin-telemetry";

type GraphQLError = {
  message: string;
  path?: Array<string | number>;
  extensions?: { code?: string };
};
type AdminResponse<T> = {
  data?: T;
  errors?: GraphQLError[];
  extensions?: { cost?: unknown; code?: unknown };
};
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
/** Last observed throttle bucket — in-process pacing only (no cross-process state). */
let lastThrottleStatus: ShopifyThrottleStatus | null = null;
let lastRequestedQueryCost: number | null = null;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function rememberThrottle(cost: ShopifyQueryCost | null) {
  if (!cost) return;
  lastThrottleStatus = cost.throttleStatus;
  if (cost.requestedQueryCost != null) lastRequestedQueryCost = cost.requestedQueryCost;
}

/** Wait when the last bucket cannot cover the next estimated request cost. */
async function paceForThrottleBudget() {
  const available = lastThrottleStatus?.currentlyAvailable;
  const restoreRate = lastThrottleStatus?.restoreRate;
  const requested = lastRequestedQueryCost;
  if (available == null || restoreRate == null || restoreRate <= 0 || requested == null) return;
  if (requested <= available) return;
  const waitMs = computeThrottleWaitMs({
    retryAfterHeader: null,
    cost: {
      requestedQueryCost: requested,
      actualQueryCost: null,
      throttleStatus: lastThrottleStatus!,
    },
  });
  if (waitMs > 0) await sleep(waitMs);
}

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
  const operation = sanitizeGraphqlOperationName(query);
  const started = performance.now();
  let httpStatus: number | null = null;
  let cost: ShopifyQueryCost | null = null;
  let logged = false;
  const mutation = isGraphqlMutation(query);
  const retryPredictedShortfall = !mutation || isIdempotentGraphqlMutation(query);

  const emit = (success: boolean) => {
    if (logged) return;
    logged = true;
    logShopifyAdminRequest({
      operation,
      durationMs: Math.round(performance.now() - started),
      httpStatus,
      cost,
      success,
    });
  };

  const config = getShopifyAdminConfig();
  let attempts = 0;
  let totalWaitMs = 0;

  await paceForThrottleBudget();

  while (true) {
    attempts += 1;
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
      emit(false);
      if (error instanceof ShopifyAdminError) throw error;
      throw new ShopifyAdminError(
        error instanceof Error ? `Unable to reach Shopify: ${error.message}` : "Unable to reach Shopify.",
      );
    }

    httpStatus = response.status;
    const retryAfterHeader = response.headers.get("Retry-After");

    if (!response.ok) {
      const failedPayload = (await response.json().catch(() => null)) as AdminResponse<T> | null;
      cost = parseShopifyQueryCost(failedPayload?.extensions);
      rememberThrottle(cost);
      const explicitThrottle = response.status === 429
        || isExplicitThrottledError(failedPayload?.errors, failedPayload?.extensions);
      const canRetry = explicitThrottle
        && attempts < SHOPIFY_THROTTLE_MAX_ATTEMPTS
        && totalWaitMs < SHOPIFY_THROTTLE_MAX_TOTAL_WAIT_MS;
      if (canRetry) {
        const waitMs = computeThrottleWaitMs({ retryAfterHeader, cost });
        totalWaitMs += waitMs;
        if (totalWaitMs <= SHOPIFY_THROTTLE_MAX_TOTAL_WAIT_MS) {
          await sleep(waitMs);
          continue;
        }
      }
      emit(false);
      if (explicitThrottle || response.status === 429) {
        throw new ShopifyAdminError(SHOPIFY_RATE_LIMIT_USER_MESSAGE, failedPayload?.errors);
      }
      throw new ShopifyAdminError(`Shopify Admin API returned ${response.status} ${response.statusText}.`);
    }

    const payload = (await response.json()) as AdminResponse<T>;
    cost = parseShopifyQueryCost(payload.extensions);
    rememberThrottle(cost);

    const explicitThrottle = isExplicitThrottledError(payload.errors, payload.extensions);
    const budgetShortfall = hasThrottleBudgetShortfall(cost);
    // Explicit THROTTLED/429 always retryable. Predicted shortfall retries only for
    // reads / idempotent mutations (never non-idempotent mutation side effects).
    const canRetryThrottle = (explicitThrottle || (budgetShortfall && retryPredictedShortfall))
      && attempts < SHOPIFY_THROTTLE_MAX_ATTEMPTS
      && totalWaitMs < SHOPIFY_THROTTLE_MAX_TOTAL_WAIT_MS;

    if (payload.errors?.length) {
      if (canRetryThrottle && (explicitThrottle || budgetShortfall)) {
        const waitMs = computeThrottleWaitMs({ retryAfterHeader, cost });
        totalWaitMs += waitMs;
        if (totalWaitMs <= SHOPIFY_THROTTLE_MAX_TOTAL_WAIT_MS) {
          await sleep(waitMs);
          continue;
        }
        emit(false);
        throw new ShopifyAdminError(SHOPIFY_RATE_LIMIT_USER_MESSAGE, payload.errors);
      }
      emit(false);
      if (explicitThrottle) {
        throw new ShopifyAdminError(SHOPIFY_RATE_LIMIT_USER_MESSAGE, payload.errors);
      }
      throw new ShopifyAdminError(payload.errors.map((error) => error.message).join("; "), payload.errors);
    }

    if (!payload.data) {
      if (canRetryThrottle && (explicitThrottle || budgetShortfall)) {
        const waitMs = computeThrottleWaitMs({ retryAfterHeader, cost });
        totalWaitMs += waitMs;
        if (totalWaitMs <= SHOPIFY_THROTTLE_MAX_TOTAL_WAIT_MS) {
          await sleep(waitMs);
          continue;
        }
        emit(false);
        throw new ShopifyAdminError(SHOPIFY_RATE_LIMIT_USER_MESSAGE);
      }
      emit(false);
      if (explicitThrottle) throw new ShopifyAdminError(SHOPIFY_RATE_LIMIT_USER_MESSAGE);
      throw new ShopifyAdminError("Shopify Admin API returned no data.");
    }

    emit(true);
    return payload.data;
  }
}

const REQUIRED_SYNC_SCOPES = [
  "write_products",
  "write_inventory",
  "write_publications",
] as const;

const TRANSLATION_SCOPES = ["read_translations", "write_translations"] as const;
const LOCALE_READ_SCOPES = ["read_locales", "read_markets_home"] as const;
const EDITORIAL_METAOBJECT_SCOPES = [
  "read_metaobjects",
  "write_metaobjects",
  "read_metaobject_definitions",
  "write_metaobject_definitions",
] as const;
const REVIEW_SCOPES = [
  "write_product_reviews",
  "read_metaobjects",
  "read_customers",
  "read_orders",
  "read_products",
] as const;

/** Needed to read and write the `synarava.wishlist` Customer metafield. */
const WISHLIST_SCOPES = ["read_customers", "write_customers"] as const;

/** Needed to subscribe to RETURNS_REQUEST lifecycle webhooks. */
const RETURNS_SCOPES = ["read_returns"] as const;

export async function fetchShopifyShopIdentity() {
  const data = await shopifyAdminRequest<{
    shop: { name: string; myshopifyDomain: string };
  }>(`query SynaravaShopIdentity {
    shop { name myshopifyDomain }
  }`);

  return data.shop;
}

export type ShopifyShopLocale = { locale: string; name: string; primary: boolean; published: boolean };

/** A registered translation locale (`StorefrontLocale`, non-default) not found enabled/published in Shopify's `shopLocales`. */
export type MissingLocalePublication = { code: string; name: string; shopifyLocale: string };

export async function fetchShopifyLocales(): Promise<ShopifyShopLocale[]> {
  const data = await shopifyAdminRequest<{ shopLocales: ShopifyShopLocale[] }>(
    `query SynaravaShopLocales {
      shopLocales { locale name primary published }
    }`,
  );
  return data.shopLocales ?? [];
}

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
  const missingScopes: string[] = REQUIRED_SYNC_SCOPES.filter(
    (scope) => !grantedScopes.includes(scope),
  );
  const canReadLocales = LOCALE_READ_SCOPES.some((scope) => grantedScopes.includes(scope));
  const missingTranslationScopes: string[] = TRANSLATION_SCOPES.filter(
    (scope) => !grantedScopes.includes(scope),
  );
  const missingReviewScopes: string[] = REVIEW_SCOPES.filter(
    (scope) => !grantedScopes.includes(scope),
  );
  const missingWishlistScopes: string[] = WISHLIST_SCOPES.filter(
    (scope) => !grantedScopes.includes(scope),
  );
  const missingReturnsScopes: string[] = RETURNS_SCOPES.filter(
    (scope) => !grantedScopes.includes(scope),
  );
  const missingEditorialScopes: string[] = EDITORIAL_METAOBJECT_SCOPES.filter(
    (scope) => !grantedScopes.includes(scope),
  );
  if (!canReadLocales) missingTranslationScopes.push("read_locales or read_markets_home");

  const locales = canReadLocales ? await fetchShopifyLocales() : [];
  const publishedShopifyLocales = new Set(
    locales.filter((locale) => locale.published).map((locale) => locale.locale.toLowerCase()),
  );
  const registeredTranslationLocales = (await listStorefrontLocales()).filter((locale) => !locale.isDefault);
  const unpublishedLocales: MissingLocalePublication[] = registeredTranslationLocales
    .filter((locale) => !publishedShopifyLocales.has(locale.shopifyLocale.toLowerCase()))
    .map((locale) => ({ code: locale.code, name: locale.name, shopifyLocale: locale.shopifyLocale }));

  return {
    shopName: data.shop.name,
    shopDomain: data.shop.myshopifyDomain,
    productCount: data.productsCount.count,
    productCountPrecision: data.productsCount.precision,
    locations: data.locations.nodes,
    publications: data.publications.nodes,
    grantedScopes,
    missingScopes,
    missingTranslationScopes,
    missingReviewScopes,
    missingWishlistScopes,
    missingReturnsScopes,
    missingEditorialScopes,
    locales,
    unpublishedLocales,
  };
}

export function shopifyNumericId(id: string | number) {
  return shopifyGid("Product", id);
}

export function shopifyGid(resource: string, id: string | number) {
  return String(id).startsWith("gid://") ? String(id) : `gid://shopify/${resource}/${id}`;
}
