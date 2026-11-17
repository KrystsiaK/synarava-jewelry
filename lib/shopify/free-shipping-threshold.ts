/**
 * Read-only discovery of Portugal domestic free-shipping min subtotal
 * from the default delivery profile (not automatic discounts).
 */
import "server-only";

import { shopifyAdminRequest } from "@/lib/shopify/admin";
import type { FreeShippingMoney, FreeShippingThresholdWindow } from "@/lib/content/announcement-bar-fields";

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

export type PortugalFreeShippingDiscovery = {
  money: FreeShippingMoney;
  window: FreeShippingThresholdWindow;
  profileGid: string;
  zoneGid: string;
  conditionGid: string;
  methodDefinitionGid: string;
};

function isPortugalZone(zone: ZoneEdge["node"]["zone"]): boolean {
  return zone.countries.some((country) => country.code.countryCode === "PT");
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

/**
 * Find Portugal (Domestic) free rate min-subtotal on the default delivery profile.
 * Returns null when no matching condition exists (do not invent a threshold).
 */
export async function fetchPortugalFreeShippingThreshold(): Promise<PortugalFreeShippingDiscovery | null> {
  const data = await shopifyAdminRequest<{
    deliveryProfiles: { edges: ProfileEdge[] };
  }>(DELIVERY_PROFILES_QUERY, { first: 10 });

  const profiles = data.deliveryProfiles.edges.map((edge) => edge.node);
  const ordered = [
    ...profiles.filter((profile) => profile.default),
    ...profiles.filter((profile) => !profile.default),
  ];

  for (const profile of ordered) {
    for (const group of profile.profileLocationGroups) {
      for (const zoneEdge of group.locationGroupZones.edges) {
        const zone = zoneEdge.node.zone;
        if (!isPortugalZone(zone)) continue;
        for (const methodEdge of zoneEdge.node.methodDefinitions.edges) {
          const method = methodEdge.node;
          const hit = freeRateCondition(method);
          if (!hit) continue;
          return {
            money: hit.money,
            window: { freeShippingMinSubtotal: hit.money },
            profileGid: profile.id,
            zoneGid: zone.id,
            conditionGid: hit.conditionGid,
            methodDefinitionGid: method.id,
          };
        }
      }
    }
  }
  return null;
}

/** Refresh-only helper used by the catalog Shopify waterfall. */
export async function refreshFreeShippingThresholdShopifyState(): Promise<FreeShippingThresholdWindow | null> {
  const discovery = await fetchPortugalFreeShippingThreshold();
  return discovery?.window ?? { freeShippingMinSubtotal: null };
}
