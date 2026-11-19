/**
 * Read-only discovery of Portugal domestic free-shipping min subtotal.
 *
 * Source depends on ShopFeatures.marketDrivenShipping:
 * - true  → Market.delivery.shipping (API 2026-07; needs read_markets)
 * - false → merchant deliveryProfiles (legacy; needs read_shipping)
 *
 * Selection is unambiguous and shared across both sources:
 * 1. Prefer a zone/market that consists of PT only.
 * 2. Among remaining candidates, take the minimum amount (what a PT buyer sees).
 * 3. Never pick silently when several distinct amounts exist — return a warning.
 */
import "server-only";

import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";
import type {
  FreeShippingMoney,
  FreeShippingObservationSource,
  FreeShippingThresholdWindow,
} from "@/lib/content/announcement-bar-fields";

/** Admin-facing reason when Shopify has no PT free domestic rate. */
export const FREE_SHIPPING_THRESHOLD_NOT_FOUND_MESSAGE =
  "No free shipping rate found for Portugal (PT) in Shopify.";

/** Admin-facing reason when delivery-profile read is blocked by scopes. */
export const FREE_SHIPPING_THRESHOLD_MISSING_SCOPE_MESSAGE =
  "Missing Shopify permission: read_shipping (cannot read delivery profiles).";

/** Admin-facing reason when market-driven shipping read is blocked by scopes. */
export const FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE =
  "Missing Shopify permission: read_markets (cannot read market-driven shipping).";

/** Admin-facing reason when no market covers Portugal. */
export const FREE_SHIPPING_THRESHOLD_NO_PORTUGAL_MARKET_MESSAGE =
  "No Portugal (PT) market found in Shopify Markets.";

export type FreeShippingThresholdRefreshResult = {
  window: FreeShippingThresholdWindow | null;
  error: string | null;
  source: FreeShippingObservationSource | null;
  warning: string | null;
};

/** Map Shopify Admin errors to a stable admin reason (never “Not checked yet”). */
export function freeShippingThresholdReadErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    // Prefer already-normalized reasons before heuristic scope matching.
    if (trimmed === FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE) {
      return FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE;
    }
    if (trimmed === FREE_SHIPPING_THRESHOLD_NO_PORTUGAL_MARKET_MESSAGE) {
      return FREE_SHIPPING_THRESHOLD_NO_PORTUGAL_MARKET_MESSAGE;
    }
    if (trimmed === FREE_SHIPPING_THRESHOLD_MISSING_SCOPE_MESSAGE) {
      return FREE_SHIPPING_THRESHOLD_MISSING_SCOPE_MESSAGE;
    }
    if (trimmed === FREE_SHIPPING_THRESHOLD_NOT_FOUND_MESSAGE) {
      return FREE_SHIPPING_THRESHOLD_NOT_FOUND_MESSAGE;
    }
  }
  if (error instanceof ShopifyAdminError) {
    const details = error.details ?? [];
    const accessDenied = details.some((detail) => detail.extensions?.code === "ACCESS_DENIED")
      || /access denied|not approved to access|ACCESS_DENIED/i.test(error.message);
    const marketsScope = /read_markets|markets field/i.test(error.message)
      || details.some((detail) => /read_markets|markets field/i.test(detail.message));
    if (accessDenied && marketsScope) {
      return FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE;
    }
    const shippingScope = /read_shipping|deliveryProfiles|shipping object/i.test(error.message)
      || details.some((detail) => /read_shipping|deliveryProfiles|shipping object/i.test(detail.message));
    if (accessDenied || shippingScope) {
      return FREE_SHIPPING_THRESHOLD_MISSING_SCOPE_MESSAGE;
    }
    return error.message.trim() || "Free-shipping threshold Shopify refresh failed.";
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Free-shipping threshold Shopify refresh failed.";
}

const SHOP_FEATURES_QUERY = `#graphql
  query ShopMarketDrivenShippingFeature {
    shop {
      features {
        marketDrivenShipping
      }
    }
  }
`;

const DELIVERY_PROFILES_QUERY = `#graphql
  query PortugalFreeShippingThreshold($first: Int!) {
    deliveryProfiles(first: $first, merchantOwnedOnly: true) {
      edges {
        node {
          id
          name
          default
          profileLocationGroups {
            locationGroupZones(first: 20) {
              edges {
                node {
                  zone {
                    id
                    name
                    countries {
                      name
                      code { countryCode restOfWorld }
                    }
                  }
                  methodDefinitions(first: 50) {
                    edges {
                      node {
                        id
                        name
                        active
                        rateProvider {
                          __typename
                          ... on DeliveryRateDefinition {
                            id
                            price { amount currencyCode }
                          }
                        }
                        methodConditions {
                          id
                          field
                          operator
                          conditionCriteria {
                            __typename
                            ... on MoneyV2 { amount currencyCode }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Market-driven shipping (Admin API 2026-07).
 * Docs: Market.delivery.shipping.optionDefinitions[].freeDeliveryMinimumValue
 * and DeliveryValueBasedRate (price 0 + minValue) as order-amount free rates.
 */
const MARKETS_SHIPPING_QUERY = `#graphql
  query PortugalMarketFreeShippingThreshold($first: Int!) {
    markets(first: $first, type: REGION) {
      nodes {
        id
        name
        status
        conditions {
          regionsCondition {
            regions(first: 50) {
              nodes {
                __typename
                ... on MarketRegionCountry {
                  code
                  name
                }
              }
            }
          }
        }
        delivery {
          shipping {
            isEnabled
            optionDefinitions(first: 50) {
              nodes {
                __typename
                id
                currency
                isActive
                freeDeliveryMinimumValue {
                  amount
                  currencyCode
                }
                ... on DeliveryFlatRateOptionDefinition {
                  name
                }
                ... on DeliveryValueBasedOptionDefinition {
                  name
                  rateGroups(first: 20) {
                    nodes {
                      rates(first: 20) {
                        nodes {
                          id
                          price { amount currencyCode }
                          minValue { amount currencyCode }
                        }
                      }
                    }
                  }
                }
                ... on DeliveryWeightBasedOptionDefinition {
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

type MoneyNode = { amount?: string | null; currencyCode?: string | null };

type MethodNode = {
  id: string;
  name: string;
  active: boolean;
  rateProvider?: {
    __typename?: string;
    id?: string;
    price?: MoneyNode | null;
  } | null;
  methodConditions?: Array<{
    id: string;
    field: string;
    operator: string;
    conditionCriteria?:
      | { __typename?: string; amount?: string | null; currencyCode?: string | null }
      | null;
  }> | null;
};

type ZoneEdge = {
  node: {
    zone: {
      id: string;
      name: string;
      countries: Array<{
        name: string;
        code: { countryCode?: string | null; restOfWorld: boolean };
      }>;
    };
    methodDefinitions: { edges: Array<{ node: MethodNode }> };
  };
};

type ProfileEdge = {
  node: {
    id: string;
    name: string;
    default: boolean;
    profileLocationGroups: Array<{
      locationGroupZones: { edges: ZoneEdge[] };
    }>;
  };
};

type MarketRegionNode = {
  __typename?: string;
  code?: string | null;
  name?: string | null;
};

type MarketValueBasedRateNode = {
  id: string;
  price?: MoneyNode | null;
  minValue?: MoneyNode | null;
};

type MarketOptionNode = {
  __typename?: string;
  id: string;
  currency?: string | null;
  isActive: boolean;
  freeDeliveryMinimumValue?: MoneyNode | null;
  name?: string | null;
  rateGroups?: {
    nodes: Array<{
      rates?: { nodes: MarketValueBasedRateNode[] } | null;
    }>;
  } | null;
};

type MarketNode = {
  id: string;
  name: string;
  status?: string | null;
  conditions?: {
    regionsCondition?: {
      regions?: { nodes: MarketRegionNode[] } | null;
    } | null;
  } | null;
  delivery?: {
    shipping?: {
      isEnabled: boolean;
      optionDefinitions?: { nodes: MarketOptionNode[] } | null;
    } | null;
  } | null;
};

/** One free-rate condition that applies to a zone/market containing PT. */
export type PortugalFreeShippingCandidate = {
  money: FreeShippingMoney;
  profileGid: string;
  profileName: string;
  zoneGid: string;
  zoneName: string;
  /** ISO country codes on the zone/market (excludes rest-of-world). */
  zoneCountryCodes: string[];
  /** True when the zone/market is exactly Portugal (no other countries / ROW). */
  isPtOnly: boolean;
  methodDefinitionGid: string;
  rateName: string;
  conditionGid: string;
};

export type PortugalFreeShippingDiscovery = {
  money: FreeShippingMoney;
  window: FreeShippingThresholdWindow;
  source: FreeShippingObservationSource;
  warning: string | null;
  profileGid: string;
  zoneGid: string;
  conditionGid: string;
  methodDefinitionGid: string;
};

export type PortugalFreeShippingSelection = {
  selected: PortugalFreeShippingCandidate | null;
  warning: string | null;
  distinctAmounts: FreeShippingMoney[];
};

function moneyKey(money: FreeShippingMoney): string {
  return `${money.currencyCode}:${money.amount}`;
}

function moneyAmount(money: FreeShippingMoney): number {
  return Number.parseFloat(money.amount);
}

function formatMoneyBrief(money: FreeShippingMoney): string {
  return `${money.amount} ${money.currencyCode}`;
}

function parseMoney(node: MoneyNode | null | undefined): FreeShippingMoney | null {
  const amount = typeof node?.amount === "string" ? node.amount.trim() : "";
  const currencyCode = typeof node?.currencyCode === "string" ? node.currencyCode.trim() : "";
  if (!amount || !currencyCode) return null;
  return { amount, currencyCode };
}

function zoneMeta(zone: ZoneEdge["node"]["zone"]): {
  codes: string[];
  isPtOnly: boolean;
  includesPt: boolean;
} {
  const hasRestOfWorld = zone.countries.some((country) => country.code.restOfWorld);
  const codes = zone.countries
    .map((country) => (typeof country.code.countryCode === "string" ? country.code.countryCode.trim() : ""))
    .filter((code) => code.length > 0);
  const includesPt = codes.includes("PT");
  const isPtOnly = includesPt && !hasRestOfWorld && codes.length === 1 && codes[0] === "PT";
  return { codes, isPtOnly, includesPt };
}

function marketRegionMeta(market: MarketNode): {
  codes: string[];
  isPtOnly: boolean;
  includesPt: boolean;
} {
  const regions = market.conditions?.regionsCondition?.regions?.nodes ?? [];
  const codes = regions
    .map((region) => (typeof region.code === "string" ? region.code.trim() : ""))
    .filter((code) => code.length > 0);
  const includesPt = codes.includes("PT");
  const isPtOnly = includesPt && codes.length === 1 && codes[0] === "PT";
  return { codes, isPtOnly, includesPt };
}

function freeRateCondition(method: MethodNode): {
  money: FreeShippingMoney;
  conditionGid: string;
} | null {
  if (!method.active) return null;
  const price = method.rateProvider?.price;
  const amount = Number.parseFloat(price?.amount ?? "NaN");
  if (!Number.isFinite(amount) || amount !== 0) return null;

  for (const condition of method.methodConditions ?? []) {
    if (condition.field !== "TOTAL_PRICE") continue;
    if (condition.operator !== "GREATER_THAN_OR_EQUAL_TO") continue;
    const criteria = condition.conditionCriteria;
    if (!criteria || criteria.__typename !== "MoneyV2") continue;
    const money = parseMoney(criteria);
    if (!money) continue;
    return {
      money,
      conditionGid: condition.id,
    };
  }
  return null;
}

/** Collect every active free rate whose zone includes Portugal. */
export function collectPortugalFreeShippingCandidates(
  profiles: ProfileEdge["node"][],
): PortugalFreeShippingCandidate[] {
  const ordered = [
    ...profiles.filter((profile) => profile.default),
    ...profiles.filter((profile) => !profile.default),
  ];
  const candidates: PortugalFreeShippingCandidate[] = [];

  for (const profile of ordered) {
    for (const group of profile.profileLocationGroups) {
      for (const zoneEdge of group.locationGroupZones.edges) {
        const zone = zoneEdge.node.zone;
        const meta = zoneMeta(zone);
        if (!meta.includesPt) continue;
        for (const methodEdge of zoneEdge.node.methodDefinitions.edges) {
          const method = methodEdge.node;
          const hit = freeRateCondition(method);
          if (!hit) continue;
          candidates.push({
            money: hit.money,
            profileGid: profile.id,
            profileName: profile.name.trim() || profile.id,
            zoneGid: zone.id,
            zoneName: zone.name.trim() || zone.id,
            zoneCountryCodes: meta.codes,
            isPtOnly: meta.isPtOnly,
            methodDefinitionGid: method.id,
            rateName: method.name.trim() || method.id,
            conditionGid: hit.conditionGid,
          });
        }
      }
    }
  }
  return candidates;
}

/**
 * Collect free-shipping order-amount thresholds from market-driven shipping.
 * Sources per option: freeDeliveryMinimumValue, and value-based rates with price 0 + minValue.
 */
export function collectPortugalMarketFreeShippingCandidates(
  markets: MarketNode[],
): PortugalFreeShippingCandidate[] {
  const candidates: PortugalFreeShippingCandidate[] = [];
  const seen = new Set<string>();

  const pushCandidate = (candidate: PortugalFreeShippingCandidate) => {
    const key = [
      candidate.profileGid,
      candidate.methodDefinitionGid,
      candidate.conditionGid,
      moneyKey(candidate.money),
    ].join("\0");
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  for (const market of markets) {
    if (market.status && market.status !== "ACTIVE") continue;
    const meta = marketRegionMeta(market);
    if (!meta.includesPt) continue;

    const shipping = market.delivery?.shipping;
    // null shipping = inherits from parent; parent (broader) markets that include PT
    // are collected separately when they define their own shipping.
    if (!shipping || !shipping.isEnabled) continue;

    const marketName = market.name.trim() || market.id;
    for (const option of shipping.optionDefinitions?.nodes ?? []) {
      if (!option.isActive) continue;
      const rateName = (typeof option.name === "string" ? option.name.trim() : "") || option.id;

      const freeMin = parseMoney(option.freeDeliveryMinimumValue);
      if (freeMin) {
        pushCandidate({
          money: freeMin,
          profileGid: market.id,
          profileName: marketName,
          zoneGid: market.id,
          zoneName: marketName,
          zoneCountryCodes: meta.codes,
          isPtOnly: meta.isPtOnly,
          methodDefinitionGid: option.id,
          rateName,
          conditionGid: `${option.id}:freeDeliveryMinimumValue`,
        });
      }

      if (option.__typename !== "DeliveryValueBasedOptionDefinition") continue;
      for (const group of option.rateGroups?.nodes ?? []) {
        for (const rate of group.rates?.nodes ?? []) {
          const priceAmount = Number.parseFloat(rate.price?.amount ?? "NaN");
          if (!Number.isFinite(priceAmount) || priceAmount !== 0) continue;
          const minValue = parseMoney(rate.minValue);
          if (!minValue) continue;
          pushCandidate({
            money: minValue,
            profileGid: market.id,
            profileName: marketName,
            zoneGid: market.id,
            zoneName: marketName,
            zoneCountryCodes: meta.codes,
            isPtOnly: meta.isPtOnly,
            methodDefinitionGid: option.id,
            rateName,
            conditionGid: rate.id,
          });
        }
      }
    }
  }
  return candidates;
}

/** True when any ACTIVE region market includes Portugal. */
export function marketsIncludePortugal(markets: readonly MarketNode[]): boolean {
  return markets.some((market) => {
    if (market.status && market.status !== "ACTIVE") return false;
    return marketRegionMeta(market).includesPt;
  });
}

/**
 * Prefer PT-only zones; then minimum amount. Warn when several distinct amounts exist.
 * Tie-break equal amounts by profile / zone / rate name for stability.
 */
export function selectPortugalFreeShippingThreshold(
  candidates: readonly PortugalFreeShippingCandidate[],
): PortugalFreeShippingSelection {
  if (candidates.length === 0) {
    return { selected: null, warning: null, distinctAmounts: [] };
  }

  const amountMap = new Map<string, FreeShippingMoney>();
  for (const candidate of candidates) {
    amountMap.set(moneyKey(candidate.money), candidate.money);
  }
  const distinctAmounts = [...amountMap.values()].toSorted(
    (a, b) => moneyAmount(a) - moneyAmount(b) || a.currencyCode.localeCompare(b.currencyCode),
  );

  const ptOnly = candidates.filter((candidate) => candidate.isPtOnly);
  const pool = ptOnly.length > 0 ? ptOnly : [...candidates];

  const selected = [...pool].toSorted((a, b) => {
    const amountDelta = moneyAmount(a.money) - moneyAmount(b.money);
    if (amountDelta !== 0) return amountDelta;
    return `${a.profileName}\0${a.zoneName}\0${a.rateName}`
      .localeCompare(`${b.profileName}\0${b.zoneName}\0${b.rateName}`);
  })[0] ?? null;

  if (!selected) {
    return { selected: null, warning: null, distinctAmounts };
  }

  const warning = distinctAmounts.length > 1
    ? [
        `Multiple Portugal free-shipping thresholds found (${distinctAmounts.map(formatMoneyBrief).join(", ")}).`,
        `Using ${formatMoneyBrief(selected.money)} from ${selected.profileName} / ${selected.zoneName} / ${selected.rateName}`,
        selected.isPtOnly ? "(PT-only zone)." : "(no PT-only zone; minimum among zones that include PT).",
      ].join(" ")
    : null;

  return { selected, warning, distinctAmounts };
}

function discoveryFromSelection(
  selected: PortugalFreeShippingCandidate,
  warning: string | null,
): PortugalFreeShippingDiscovery {
  return {
    money: selected.money,
    window: { freeShippingMinSubtotal: selected.money },
    source: {
      profileName: selected.profileName,
      zoneName: selected.zoneName,
      rateName: selected.rateName,
    },
    warning,
    profileGid: selected.profileGid,
    zoneGid: selected.zoneGid,
    conditionGid: selected.conditionGid,
    methodDefinitionGid: selected.methodDefinitionGid,
  };
}

async function fetchViaDeliveryProfiles(): Promise<PortugalFreeShippingDiscovery | null> {
  const data = await shopifyAdminRequest<{
    deliveryProfiles: { edges: ProfileEdge[] };
  }>(DELIVERY_PROFILES_QUERY, { first: 10 });

  const profiles = data.deliveryProfiles.edges.map((edge) => edge.node);
  const { selected, warning } = selectPortugalFreeShippingThreshold(
    collectPortugalFreeShippingCandidates(profiles),
  );
  if (!selected) return null;
  return discoveryFromSelection(selected, warning);
}

async function fetchViaMarketDrivenShipping(): Promise<PortugalFreeShippingDiscovery | null> {
  let data: { markets: { nodes: MarketNode[] } };
  try {
    data = await shopifyAdminRequest<{ markets: { nodes: MarketNode[] } }>(
      MARKETS_SHIPPING_QUERY,
      { first: 50 },
    );
  } catch (error) {
    if (error instanceof ShopifyAdminError) {
      const details = error.details ?? [];
      const accessDenied = details.some((detail) => detail.extensions?.code === "ACCESS_DENIED")
        || /access denied|ACCESS_DENIED|read_markets/i.test(error.message)
        || details.some((detail) => /read_markets|markets field/i.test(detail.message));
      if (accessDenied) {
        throw new ShopifyAdminError(
          FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE,
          error.details,
        );
      }
    }
    throw error;
  }

  const markets = data.markets.nodes;
  if (!marketsIncludePortugal(markets)) {
    throw new Error(FREE_SHIPPING_THRESHOLD_NO_PORTUGAL_MARKET_MESSAGE);
  }

  const { selected, warning } = selectPortugalFreeShippingThreshold(
    collectPortugalMarketFreeShippingCandidates(markets),
  );
  if (!selected) return null;
  return discoveryFromSelection(selected, warning);
}

/**
 * Find Portugal free-rate min-subtotal via the single selection mechanism above.
 * Returns null when no matching condition exists (do not invent a threshold).
 * When market-driven shipping is on, never falls back to deliveryProfiles.
 */
export async function fetchPortugalFreeShippingThreshold(): Promise<PortugalFreeShippingDiscovery | null> {
  const features = await shopifyAdminRequest<{
    shop: { features: { marketDrivenShipping: boolean } };
  }>(SHOP_FEATURES_QUERY);

  if (features.shop.features.marketDrivenShipping) {
    return fetchViaMarketDrivenShipping();
  }
  return fetchViaDeliveryProfiles();
}

/** Refresh-only helper used by the catalog Shopify waterfall. */
export async function refreshFreeShippingThresholdShopifyState(): Promise<FreeShippingThresholdRefreshResult> {
  try {
    const discovery = await fetchPortugalFreeShippingThreshold();
    if (!discovery) {
      return {
        window: { freeShippingMinSubtotal: null },
        error: FREE_SHIPPING_THRESHOLD_NOT_FOUND_MESSAGE,
        source: null,
        warning: null,
      };
    }
    return {
      window: discovery.window,
      error: null,
      source: discovery.source,
      warning: discovery.warning,
    };
  } catch (error) {
    return {
      window: null,
      error: freeShippingThresholdReadErrorMessage(error),
      source: null,
      warning: null,
    };
  }
}
