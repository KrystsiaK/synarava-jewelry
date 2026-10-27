import { afterEach, describe, expect, it, vi } from "vitest";

import {
  computeThrottleWaitMs,
  isExplicitThrottledError,
  isGraphqlMutation,
  isIdempotentGraphqlMutation,
  logProductPushTiming,
  logShopifyAdminRequest,
  logSyncWaterfallTiming,
  parseRetryAfterMs,
  parseShopifyQueryCost,
  sanitizeGraphqlOperationName,
} from "@/lib/shopify/admin-telemetry";

describe("admin-telemetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives sanitized operation names from GraphQL documents", () => {
    expect(sanitizeGraphqlOperationName("query SynaravaProduct { product { id } }")).toBe("SynaravaProduct");
    expect(
      sanitizeGraphqlOperationName(
        `mutation SynaravaProductSet($input: ProductSetInput!) {\n  productSet(input: $input) { product { id } }\n}`,
      ),
    ).toBe("SynaravaProductSet");
    expect(sanitizeGraphqlOperationName("{ shop { name } }")).toBe("anonymous");
  });

  it("parses extensions.cost including throttle fields", () => {
    expect(
      parseShopifyQueryCost({
        cost: {
          requestedQueryCost: 42,
          actualQueryCost: 7,
          throttleStatus: {
            maximumAvailable: 2000,
            currentlyAvailable: 1993,
            restoreRate: 100,
          },
        },
      }),
    ).toEqual({
      requestedQueryCost: 42,
      actualQueryCost: 7,
      throttleStatus: {
        maximumAvailable: 2000,
        currentlyAvailable: 1993,
        restoreRate: 100,
      },
    });
    expect(parseShopifyQueryCost(undefined)).toBeNull();
    expect(parseShopifyQueryCost({ cost: null })).toBeNull();
  });

  it("emits one structured admin request log without secrets or payload data", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logShopifyAdminRequest({
      operation: "SynaravaProduct",
      durationMs: 12,
      httpStatus: 200,
      cost: {
        requestedQueryCost: 10,
        actualQueryCost: 3,
        throttleStatus: {
          maximumAvailable: 2000,
          currentlyAvailable: 1997,
          restoreRate: 100,
        },
      },
      success: true,
    });

    expect(info).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload).toEqual({
      event: "shopify.admin.request",
      operation: "SynaravaProduct",
      durationMs: 12,
      httpStatus: 200,
      requestedQueryCost: 10,
      actualQueryCost: 3,
      maximumAvailable: 2000,
      currentlyAvailable: 1997,
      restoreRate: 100,
      success: true,
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/shpat_|client.secret|variables|sku|https?:\/\//i);
    expect(serialized).not.toContain("title");
  });

  it("classifies mutations and explicit throttle signals", () => {
    expect(isGraphqlMutation("mutation SynaravaProductSet { productSet { id } }")).toBe(true);
    expect(isGraphqlMutation("query SynaravaProduct { product { id } }")).toBe(false);
    expect(isIdempotentGraphqlMutation("mutation X { inventoryActivate @idempotent(key: $k) { id } }")).toBe(true);
    expect(isIdempotentGraphqlMutation("mutation X { productSet { id } }")).toBe(false);
    expect(isExplicitThrottledError([{ message: "Throttled", extensions: { code: "THROTTLED" } }], null)).toBe(true);
    expect(isExplicitThrottledError([{ message: "Access denied" }], { code: "ACCESS_DENIED" })).toBe(false);
    expect(parseRetryAfterMs("2")).toBe(2000);
    expect(computeThrottleWaitMs({
      retryAfterHeader: "1",
      cost: {
        requestedQueryCost: 200,
        actualQueryCost: null,
        throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 0, restoreRate: 100 },
      },
      jitterMs: 0,
    })).toBe(2000);
  });

  it("emits waterfall and push timing summaries with counts only", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logSyncWaterfallTiming({
      scopeKind: "catalog",
      trigger: "MANUAL",
      totalMs: 1000,
      translationsMs: 100,
      productPresenceMs: 50,
      collectionPresenceMs: 40,
      productCommerceMs: 400,
      collectionCommerceMs: 200,
      compareReadMs: 80,
      compareCpuMs: 20,
      linkedProductCount: 2,
      linkedCollectionCount: 1,
      translationBindingCount: 5,
      localeCount: 3,
      warningCount: 0,
      status: "SUCCEEDED",
    });
    logProductPushTiming({
      currentFetchMs: 10,
      stagingUploadMs: 20,
      productSetMs: 30,
      publicationMs: 5,
      collectionMembershipMs: 8,
      metafieldsMs: 12,
      metafieldTranslationsMs: 7,
      variantInventoryMs: 15,
      mediaSettlementMs: 9,
      finalSnapshotMs: 11,
      productTranslationsMs: 6,
      totalMs: 133,
      success: true,
    });

    expect(info).toHaveBeenCalledTimes(2);
    const waterfall = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<string, unknown>;
    const push = JSON.parse(String(info.mock.calls[1]?.[0])) as Record<string, unknown>;
    expect(waterfall.event).toBe("shopify.sync.waterfall");
    expect(waterfall.scopeKind).toBe("catalog");
    expect(push.event).toBe("shopify.product.push");
    const joined = `${JSON.stringify(waterfall)}\n${JSON.stringify(push)}`;
    expect(joined).not.toMatch(/gid:\/\/shopify|sku-|https?:\/\/|shpat_|username|title|token/i);
  });
});
