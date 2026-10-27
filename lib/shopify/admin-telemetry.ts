/**
 * Sanitized Shopify Admin GraphQL cost + timing telemetry.
 * Never log documents, variables, resource IDs, titles, SKUs, URLs, or tokens.
 */

export type ShopifyThrottleStatus = {
  maximumAvailable: number | null;
  currentlyAvailable: number | null;
  restoreRate: number | null;
};

export type ShopifyQueryCost = {
  requestedQueryCost: number | null;
  actualQueryCost: number | null;
  throttleStatus: ShopifyThrottleStatus;
};

const OPERATION_NAME_RE = /^\s*(?:query|mutation|subscription)\s+([A-Za-z_][\w]*)/m;

/** Named operation only (e.g. SynaravaProduct). Never the document body. */
export function sanitizeGraphqlOperationName(document: string): string {
  return document.match(OPERATION_NAME_RE)?.[1] ?? "anonymous";
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Decode `extensions.cost` when present (including failed GraphQL payloads). */
export function parseShopifyQueryCost(extensions: unknown): ShopifyQueryCost | null {
  if (!extensions || typeof extensions !== "object" || Array.isArray(extensions)) return null;
  const cost = (extensions as { cost?: unknown }).cost;
  if (!cost || typeof cost !== "object" || Array.isArray(cost)) return null;
  const record = cost as Record<string, unknown>;
  const throttleRaw = record.throttleStatus;
  const throttle =
    throttleRaw && typeof throttleRaw === "object" && !Array.isArray(throttleRaw)
      ? (throttleRaw as Record<string, unknown>)
      : null;
  return {
    requestedQueryCost: asFiniteNumber(record.requestedQueryCost),
    actualQueryCost: asFiniteNumber(record.actualQueryCost),
    throttleStatus: {
      maximumAvailable: asFiniteNumber(throttle?.maximumAvailable),
      currentlyAvailable: asFiniteNumber(throttle?.currentlyAvailable),
      restoreRate: asFiniteNumber(throttle?.restoreRate),
    },
  };
}

export const SHOPIFY_RATE_LIMIT_USER_MESSAGE =
  "Shopify is rate-limiting requests; wait a few seconds and try again";

export const SHOPIFY_THROTTLE_MAX_ATTEMPTS = 5;
export const SHOPIFY_THROTTLE_MAX_WAIT_MS = 10_000;
export const SHOPIFY_THROTTLE_MAX_TOTAL_WAIT_MS = 30_000;

export function isGraphqlMutation(document: string): boolean {
  return /^\s*mutation\b/m.test(document);
}

export function isIdempotentGraphqlMutation(document: string): boolean {
  return isGraphqlMutation(document) && /@idempotent\b/.test(document);
}

/** True when GraphQL errors/extensions report an explicit THROTTLED code. */
export function isExplicitThrottledError(
  errors: Array<{ message?: string; extensions?: { code?: unknown } }> | undefined,
  extensions: unknown,
): boolean {
  if (errors?.some((error) => {
    const code = error.extensions?.code;
    if (typeof code === "string" && code.toUpperCase() === "THROTTLED") return true;
    return typeof error.message === "string" && /^throttled\.?$/i.test(error.message.trim());
  })) {
    return true;
  }
  if (extensions && typeof extensions === "object" && !Array.isArray(extensions)) {
    const code = (extensions as { code?: unknown }).code;
    if (typeof code === "string" && code.toUpperCase() === "THROTTLED") return true;
  }
  return false;
}

export function hasThrottleBudgetShortfall(cost: ShopifyQueryCost | null): boolean {
  const requested = cost?.requestedQueryCost;
  const available = cost?.throttleStatus.currentlyAvailable;
  return requested != null && available != null && requested > available;
}

export function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.ceil(asSeconds * 1_000);
  const asDate = Date.parse(header);
  if (!Number.isFinite(asDate)) return null;
  return Math.max(0, asDate - Date.now());
}

/** Delay from Retry-After and/or cost shortfall, plus jitter, capped per wait. */
export function computeThrottleWaitMs(input: {
  retryAfterHeader: string | null;
  cost: ShopifyQueryCost | null;
  jitterMs?: number;
}): number {
  const retryAfterMs = parseRetryAfterMs(input.retryAfterHeader) ?? 0;
  const requested = input.cost?.requestedQueryCost;
  const available = input.cost?.throttleStatus.currentlyAvailable;
  const restoreRate = input.cost?.throttleStatus.restoreRate;
  let shortfallMs = 0;
  if (
    requested != null
    && available != null
    && restoreRate != null
    && restoreRate > 0
    && requested > available
  ) {
    shortfallMs = Math.ceil(((requested - available) / restoreRate) * 1_000);
  }
  const jitter = input.jitterMs ?? Math.floor(Math.random() * 100);
  const base = Math.max(retryAfterMs, shortfallMs, 250);
  return Math.min(SHOPIFY_THROTTLE_MAX_WAIT_MS, base + jitter);
}

export function logShopifyAdminRequest(fields: {
  operation: string;
  durationMs: number;
  httpStatus: number | null;
  cost: ShopifyQueryCost | null;
  success: boolean;
}) {
  console.info(
    JSON.stringify({
      event: "shopify.admin.request",
      operation: fields.operation,
      durationMs: fields.durationMs,
      httpStatus: fields.httpStatus,
      requestedQueryCost: fields.cost?.requestedQueryCost ?? null,
      actualQueryCost: fields.cost?.actualQueryCost ?? null,
      maximumAvailable: fields.cost?.throttleStatus.maximumAvailable ?? null,
      currentlyAvailable: fields.cost?.throttleStatus.currentlyAvailable ?? null,
      restoreRate: fields.cost?.throttleStatus.restoreRate ?? null,
      success: fields.success,
    }),
  );
}

export type SyncWaterfallTimingLog = {
  scopeKind: string;
  trigger: string | null;
  totalMs: number;
  translationsMs: number;
  productPresenceMs: number;
  collectionPresenceMs: number;
  productCommerceMs: number;
  collectionCommerceMs: number;
  compareReadMs: number;
  compareCpuMs: number;
  linkedProductCount: number;
  linkedCollectionCount: number;
  translationBindingCount: number;
  localeCount: number;
  warningCount: number;
  status: string;
};

export function logSyncWaterfallTiming(fields: SyncWaterfallTimingLog) {
  console.info(
    JSON.stringify({
      event: "shopify.sync.waterfall",
      scopeKind: fields.scopeKind,
      trigger: fields.trigger,
      totalMs: fields.totalMs,
      translationsMs: fields.translationsMs,
      productPresenceMs: fields.productPresenceMs,
      collectionPresenceMs: fields.collectionPresenceMs,
      productCommerceMs: fields.productCommerceMs,
      collectionCommerceMs: fields.collectionCommerceMs,
      compareReadMs: fields.compareReadMs,
      compareCpuMs: fields.compareCpuMs,
      linkedProductCount: fields.linkedProductCount,
      linkedCollectionCount: fields.linkedCollectionCount,
      translationBindingCount: fields.translationBindingCount,
      localeCount: fields.localeCount,
      warningCount: fields.warningCount,
      status: fields.status,
    }),
  );
}

export type ProductPushTimingLog = {
  currentFetchMs: number;
  stagingUploadMs: number;
  productSetMs: number;
  publicationMs: number;
  collectionMembershipMs: number;
  metafieldsMs: number;
  metafieldTranslationsMs: number;
  variantInventoryMs: number;
  mediaSettlementMs: number;
  finalSnapshotMs: number;
  productTranslationsMs: number;
  totalMs: number;
  success: boolean;
};

export function logProductPushTiming(fields: ProductPushTimingLog) {
  console.info(
    JSON.stringify({
      event: "shopify.product.push",
      currentFetchMs: fields.currentFetchMs,
      stagingUploadMs: fields.stagingUploadMs,
      productSetMs: fields.productSetMs,
      publicationMs: fields.publicationMs,
      collectionMembershipMs: fields.collectionMembershipMs,
      metafieldsMs: fields.metafieldsMs,
      metafieldTranslationsMs: fields.metafieldTranslationsMs,
      variantInventoryMs: fields.variantInventoryMs,
      mediaSettlementMs: fields.mediaSettlementMs,
      finalSnapshotMs: fields.finalSnapshotMs,
      productTranslationsMs: fields.productTranslationsMs,
      totalMs: fields.totalMs,
      success: fields.success,
    }),
  );
}

export async function measureMs<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const started = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - started) };
}
