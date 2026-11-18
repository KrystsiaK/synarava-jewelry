/**
 * Read-only discovery of Portugal domestic free-shipping min subtotal
 * from delivery profiles (not automatic discounts).
 *
 * Selection is unambiguous:
 * 1. Prefer a zone that consists of PT only.
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

export type FreeShippingThresholdRefreshResult = {
  window: FreeShippingThresholdWindow | null;
  error: string | null;
  source: FreeShippingObservationSource | null;
  warning: string | null;
};

/** Map Shopify Admin errors to a stable admin reason (never “Not checked yet”). */
export function freeShippingThresholdReadErrorMessage(error: unknown): string {
  if (error instanceof ShopifyAdminError) {
    const details = error.details ?? [];
    const accessDenied = details.some((detail) => detail.extensions?.code === "ACCESS_DENIED")
      || /access denied|not approved to access|ACCESS_DENIED/i.test(error.message);
    const shippingScope = /read_shipping|deliveryProfiles|shipping/i.test(error.message)
      || details.some((detail) => /read_shipping|deliveryProfiles|shipping/i.test(detail.message));
    if (accessDenied || shippingScope) {
      return FREE_SHIPPING_THRESHOLD_MISSING_SCOPE_MESSAGE;
    }
    return error.message.trim() || "Free-shipping threshold Shopify refresh failed.";
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Free-shipping threshold Shopify refresh failed.";
}

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

/** One free-rate condition that applies to a zone containing PT. */
export type PortugalFreeShippingCandidate = {
  money: FreeShippingMoney;
  profileGid: string;
  profileName: string;
  zoneGid: string;
  zoneName: string;
  /** ISO country codes on the zone (excludes rest-of-world). */
  zoneCountryCodes: string[];
  /** True when the zone is exactly Portugal (no other countries / ROW). */
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
    const minAmount = typeof criteria.amount === "string" ? criteria.amount.trim() : "";
    const currencyCode = typeof criteria.currencyCode === "string" ? criteria.currencyCode.trim() : "";
    if (!minAmount || !currencyCode) continue;
    return {
      money: { amount: minAmount, currencyCode },
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

/**
 * Find Portugal free-rate min-subtotal via the single selection mechanism above.
 * Returns null when no matching condition exists (do not invent a threshold).
 */
export async function fetchPortugalFreeShippingThreshold(): Promise<PortugalFreeShippingDiscovery | null> {
  const data = await shopifyAdminRequest<{
    deliveryProfiles: { edges: ProfileEdge[] };
  }>(DELIVERY_PROFILES_QUERY, { first: 10 });

  const profiles = data.deliveryProfiles.edges.map((edge) => edge.node);
  const { selected, warning } = selectPortugalFreeShippingThreshold(
    collectPortugalFreeShippingCandidates(profiles),
  );
  if (!selected) return null;

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
