import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => {
  class ShopifyAdminError extends Error {
    constructor(message: string, readonly details?: Array<{
      message: string;
      extensions?: { code?: string };
    }>) {
      super(message);
      this.name = "ShopifyAdminError";
    }
  }
  return {
    shopifyAdminRequest: mocks.shopifyAdminRequest,
    ShopifyAdminError,
  };
});

import { ShopifyAdminError } from "@/lib/shopify/admin";
import {
  FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE,
  FREE_SHIPPING_THRESHOLD_MISSING_SCOPE_MESSAGE,
  FREE_SHIPPING_THRESHOLD_NO_PORTUGAL_MARKET_MESSAGE,
  FREE_SHIPPING_THRESHOLD_NOT_FOUND_MESSAGE,
  collectPortugalMarketFreeShippingCandidates,
  fetchPortugalFreeShippingThreshold,
  refreshFreeShippingThresholdShopifyState,
  selectPortugalFreeShippingThreshold,
} from "@/lib/shopify/free-shipping-threshold";

beforeEach(() => {
  vi.clearAllMocks();
});

function marketNode(input: {
  id?: string;
  name: string;
  codes: string[];
  status?: string;
  shipping: null | {
    isEnabled: boolean;
    options: Array<{
      id: string;
      name: string;
      isActive?: boolean;
      __typename?: string;
      freeDeliveryMinimumValue?: { amount: string; currencyCode: string } | null;
      valueBasedRates?: Array<{
        id: string;
        price: { amount: string; currencyCode: string };
        minValue: { amount: string; currencyCode: string };
      }>;
    }>;
  };
}) {
  return {
    id: input.id ?? `gid://shopify/Market/${input.name}`,
    name: input.name,
    status: input.status ?? "ACTIVE",
    conditions: {
      regionsCondition: {
        regions: {
          nodes: input.codes.map((code) => ({
            __typename: "MarketRegionCountry",
            code,
            name: code,
          })),
        },
      },
    },
    delivery: {
      shipping: input.shipping
        ? {
            isEnabled: input.shipping.isEnabled,
            optionDefinitions: {
              nodes: input.shipping.options.map((option) => ({
                __typename: option.__typename
                  ?? (option.valueBasedRates ? "DeliveryValueBasedOptionDefinition" : "DeliveryFlatRateOptionDefinition"),
                id: option.id,
                currency: "EUR",
                isActive: option.isActive ?? true,
                freeDeliveryMinimumValue: option.freeDeliveryMinimumValue ?? null,
                name: option.name,
                rateGroups: option.valueBasedRates
                  ? {
                      nodes: [{
                        rates: {
                          nodes: option.valueBasedRates,
                        },
                      }],
                    }
                  : null,
              })),
            },
          }
        : null,
    },
  };
}

describe("collectPortugalMarketFreeShippingCandidates", () => {
  it("reads freeDeliveryMinimumValue from the PT-only market", () => {
    const candidates = collectPortugalMarketFreeShippingCandidates([
      marketNode({
        name: "Portugal",
        codes: ["PT"],
        shipping: {
          isEnabled: true,
          options: [{
            id: "gid://shopify/DeliveryFlatRateOptionDefinition/1",
            name: "Standard",
            freeDeliveryMinimumValue: { amount: "49.0", currencyCode: "EUR" },
          }],
        },
      }),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.money).toEqual({ amount: "49.0", currencyCode: "EUR" });
    expect(candidates[0]?.isPtOnly).toBe(true);
  });

  it("includes value-based free rates (price 0 + minValue) as order-amount thresholds", () => {
    const candidates = collectPortugalMarketFreeShippingCandidates([
      marketNode({
        name: "Portugal",
        codes: ["PT"],
        shipping: {
          isEnabled: true,
          options: [{
            id: "gid://shopify/DeliveryValueBasedOptionDefinition/1",
            name: "Cart value",
            __typename: "DeliveryValueBasedOptionDefinition",
            valueBasedRates: [{
              id: "gid://shopify/DeliveryValueBasedRate/9",
              price: { amount: "0.0", currencyCode: "EUR" },
              minValue: { amount: "49.0", currencyCode: "EUR" },
            }],
          }],
        },
      }),
    ]);
    expect(candidates[0]?.money).toEqual({ amount: "49.0", currencyCode: "EUR" });
    expect(candidates[0]?.conditionGid).toBe("gid://shopify/DeliveryValueBasedRate/9");
  });
});

describe("fetchPortugalFreeShippingThreshold market-driven path", () => {
  it("uses Market.delivery.shipping when marketDrivenShipping is true and prefers PT 49 over EU 69", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        shop: { features: { marketDrivenShipping: true } },
      })
      .mockResolvedValueOnce({
        markets: {
          nodes: [
            marketNode({
              name: "European Union",
              codes: ["PT", "ES", "FR"],
              shipping: {
                isEnabled: true,
                options: [{
                  id: "gid://shopify/DeliveryFlatRateOptionDefinition/eu",
                  name: "EU free",
                  freeDeliveryMinimumValue: { amount: "69.0", currencyCode: "EUR" },
                }],
              },
            }),
            marketNode({
              name: "Portugal",
              codes: ["PT"],
              shipping: {
                isEnabled: true,
                options: [{
                  id: "gid://shopify/DeliveryFlatRateOptionDefinition/pt",
                  name: "Domestic free",
                  freeDeliveryMinimumValue: { amount: "49.0", currencyCode: "EUR" },
                }],
              },
            }),
          ],
        },
      });

    const discovery = await fetchPortugalFreeShippingThreshold();
    expect(discovery?.money).toEqual({ amount: "49.0", currencyCode: "EUR" });
    expect(discovery?.source).toEqual({
      profileName: "Portugal",
      zoneName: "Portugal",
      rateName: "Domestic free",
    });
    expect(discovery?.warning).toMatch(/Multiple Portugal free-shipping thresholds/);
    expect(mocks.shopifyAdminRequest.mock.calls[1]?.[0]).toContain("markets(");
    expect(mocks.shopifyAdminRequest.mock.calls[1]?.[0]).toContain("freeDeliveryMinimumValue");
    expect(mocks.shopifyAdminRequest.mock.calls.some((call) => String(call[0]).includes("deliveryProfiles"))).toBe(false);
  });

  it("keeps the deliveryProfiles path when marketDrivenShipping is false", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        shop: { features: { marketDrivenShipping: false } },
      })
      .mockResolvedValueOnce({
        deliveryProfiles: {
          edges: [{
            node: {
              id: "gid://shopify/DeliveryProfile/1",
              name: "General",
              default: true,
              profileLocationGroups: [{
                locationGroupZones: {
                  edges: [{
                    node: {
                      zone: {
                        id: "gid://shopify/DeliveryZone/pt",
                        name: "Portugal",
                        countries: [{
                          name: "Portugal",
                          code: { countryCode: "PT", restOfWorld: false },
                        }],
                      },
                      methodDefinitions: {
                        edges: [{
                          node: {
                            id: "gid://shopify/DeliveryMethodDefinition/1",
                            name: "Free shipping",
                            active: true,
                            rateProvider: {
                              __typename: "DeliveryRateDefinition",
                              id: "gid://shopify/DeliveryRateDefinition/1",
                              price: { amount: "0.0", currencyCode: "EUR" },
                            },
                            methodConditions: [{
                              id: "gid://shopify/DeliveryCondition/1",
                              field: "TOTAL_PRICE",
                              operator: "GREATER_THAN_OR_EQUAL_TO",
                              conditionCriteria: {
                                __typename: "MoneyV2",
                                amount: "45.0",
                                currencyCode: "EUR",
                              },
                            }],
                          },
                        }],
                      },
                    },
                  }],
                },
              }],
            },
          }],
        },
      });

    const discovery = await fetchPortugalFreeShippingThreshold();
    expect(discovery?.money).toEqual({ amount: "45.0", currencyCode: "EUR" });
    expect(mocks.shopifyAdminRequest.mock.calls[1]?.[0]).toContain("deliveryProfiles");
    expect(mocks.shopifyAdminRequest.mock.calls.some((call) => String(call[0]).includes("markets("))).toBe(false);
  });

  it("surfaces missing read_markets without falling back to deliveryProfiles", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        shop: { features: { marketDrivenShipping: true } },
      })
      .mockRejectedValueOnce(
        new ShopifyAdminError("Access denied for markets field.", [{
          message: "Access denied for markets field. Required access: `read_markets`",
          extensions: { code: "ACCESS_DENIED" },
        }]),
      );

    const result = await refreshFreeShippingThresholdShopifyState();
    expect(result).toEqual({
      window: null,
      error: FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE,
      source: null,
      warning: null,
    });
    expect(mocks.shopifyAdminRequest.mock.calls.some((call) => String(call[0]).includes("deliveryProfiles"))).toBe(false);
  });

  it("surfaces an explicit error when no Portugal market exists", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        shop: { features: { marketDrivenShipping: true } },
      })
      .mockResolvedValueOnce({
        markets: {
          nodes: [
            marketNode({
              name: "Spain",
              codes: ["ES"],
              shipping: {
                isEnabled: true,
                options: [{
                  id: "gid://shopify/DeliveryFlatRateOptionDefinition/es",
                  name: "ES free",
                  freeDeliveryMinimumValue: { amount: "40.0", currencyCode: "EUR" },
                }],
              },
            }),
          ],
        },
      });

    const result = await refreshFreeShippingThresholdShopifyState();
    expect(result.error).toBe(FREE_SHIPPING_THRESHOLD_NO_PORTUGAL_MARKET_MESSAGE);
    expect(result.window).toBeNull();
  });

  it("returns not-found when a PT market exists but has no free-shipping threshold", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        shop: { features: { marketDrivenShipping: true } },
      })
      .mockResolvedValueOnce({
        markets: {
          nodes: [
            marketNode({
              name: "Portugal",
              codes: ["PT"],
              shipping: {
                isEnabled: true,
                options: [{
                  id: "gid://shopify/DeliveryFlatRateOptionDefinition/pt",
                  name: "Paid only",
                  freeDeliveryMinimumValue: null,
                }],
              },
            }),
          ],
        },
      });

    const result = await refreshFreeShippingThresholdShopifyState();
    expect(result.error).toBe(FREE_SHIPPING_THRESHOLD_NOT_FOUND_MESSAGE);
    expect(result.window).toEqual({ freeShippingMinSubtotal: null });
  });
});

describe("market candidate selection shares selectPortugalFreeShippingThreshold", () => {
  it("prefers PT-only market amount via the shared selector", () => {
    const candidates = collectPortugalMarketFreeShippingCandidates([
      marketNode({
        name: "European Union",
        codes: ["PT", "ES"],
        shipping: {
          isEnabled: true,
          options: [{
            id: "opt-eu",
            name: "EU",
            freeDeliveryMinimumValue: { amount: "69.0", currencyCode: "EUR" },
          }],
        },
      }),
      marketNode({
        name: "Portugal",
        codes: ["PT"],
        shipping: {
          isEnabled: true,
          options: [{
            id: "opt-pt",
            name: "PT",
            freeDeliveryMinimumValue: { amount: "49.0", currencyCode: "EUR" },
          }],
        },
      }),
    ]);
    const result = selectPortugalFreeShippingThreshold(candidates);
    expect(result.selected?.money).toEqual({ amount: "49.0", currencyCode: "EUR" });
    expect(result.selected?.isPtOnly).toBe(true);
    expect(result.warning).toMatch(/49\.0 EUR/);
  });
});

describe("legacy scope mapping still works", () => {
  it("maps deliveryProfiles ACCESS_DENIED to read_shipping", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        shop: { features: { marketDrivenShipping: false } },
      })
      .mockRejectedValueOnce(
        new ShopifyAdminError("Access denied for deliveryProfiles field.", [{
          message: "Access denied for deliveryProfiles field. Required access: `read_shipping`",
          extensions: { code: "ACCESS_DENIED" },
        }]),
      );

    const result = await refreshFreeShippingThresholdShopifyState();
    expect(result.error).toBe(FREE_SHIPPING_THRESHOLD_MISSING_SCOPE_MESSAGE);
  });
});
