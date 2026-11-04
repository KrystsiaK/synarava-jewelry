import {
  ANALYTICS_NODE_KEY,
  ANALYTICS_NOT_CONNECTED_MESSAGE,
} from "@/lib/mission-control/analytics/types";
import {
  MISSION_CONTROL_FLOW_STATUS_FIXTURES,
  MISSION_CONTROL_NODE_STATUS_FIXTURES,
} from "@/lib/mission-control/fixtures";
import { getOrdersStatus } from "@/lib/mission-control/providers/orders";
import { getShopifySyncStatus } from "@/lib/mission-control/providers/shopify-sync";
import { getSiteHealthStatus } from "@/lib/mission-control/providers/site-health";
import {
  readLatestCollectorCheckedAt,
  readServiceNodeStatus,
  type ServiceFlowStatusRecord,
  type ServiceNodeStatusRecord,
} from "@/lib/mission-control/status";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

/**
 * Live provider keys. Request-time probes still cover site/shopify/orders;
 * `analytics` is collector-persisted only (never call GA/Clarity from the hub).
 */
export const LIVE_NODE_KEYS = [
  "site-health",
  "shopify-sync",
  "orders",
  ANALYTICS_NODE_KEY,
] as const;

export type LiveNodeKey = (typeof LIVE_NODE_KEYS)[number];

/** Live keys probed at request time (local DB / own health). */
export const REQUEST_TIME_LIVE_KEYS = [
  "site-health",
  "shopify-sync",
  "orders",
] as const;

/** Live keys that the hub reads only from ServiceNodeStatus. */
export const COLLECTOR_ONLY_LIVE_KEYS = [ANALYTICS_NODE_KEY] as const;

/**
 * Intentional placeholders (no provider yet). Drift check ignores these;
 * WiringConfig nodes outside LIVE + PLACEHOLDER are logged as drift.
 */
export const PLACEHOLDER_NODE_KEYS = [
  "products",
  ...getMissionControlWiringConfig().nodes
    .filter((node) => node.kind !== "live")
    .map((node) => node.widgetKey),
];

export type PlaceholderNodeKey = string;

const PLACEHOLDER_KEY_SET: ReadonlySet<string> = new Set(PLACEHOLDER_NODE_KEYS);

export type MissionControlSnapshot = {
  nodeStatuses: ServiceNodeStatusRecord[];
  flowStatuses: ServiceFlowStatusRecord[];
  nowMs: number;
  /**
   * Max `checkedAt` from ServiceNodeStatus for live keys (collector cron).
   * Null when the collector has never written — hub must treat as stale.
   */
  collectorCheckedAt: Date | null;
  /** True while any catalog node still uses fixture/placeholder data. */
  showPlaceholderNotice: boolean;
  placeholderNodeKeys: string[];
};

export function placeholderNodeStatusesFromFixtures(
  fixtures: readonly ServiceNodeStatusRecord[] = MISSION_CONTROL_NODE_STATUS_FIXTURES,
): ServiceNodeStatusRecord[] {
  return fixtures.filter((row) => PLACEHOLDER_KEY_SET.has(row.nodeKey));
}

function awaitingAnalyticsCollector(now: Date): ServiceNodeStatusRecord {
  return {
    nodeKey: ANALYTICS_NODE_KEY,
    level: "unknown",
    message: ANALYTICS_NOT_CONNECTED_MESSAGE,
    counters: null,
    href: "/admin/mission-control",
    checkedAt: now,
    updatedAt: now,
  };
}

/**
 * Merge request-time live providers, collector-persisted analytics, and
 * fixture placeholders. Hub never calls GA/Clarity from this path.
 */
export async function loadMissionControlSnapshot(
  now: Date = new Date(),
): Promise<MissionControlSnapshot> {
  const [siteHealth, shopifySync, orders, analyticsStored, collectorCheckedAt] =
    await Promise.all([
      getSiteHealthStatus({ now }),
      getShopifySyncStatus({ now }),
      getOrdersStatus({ now }),
      readServiceNodeStatus(ANALYTICS_NODE_KEY),
      readLatestCollectorCheckedAt(LIVE_NODE_KEYS),
    ]);

  const analytics = analyticsStored ?? awaitingAnalyticsCollector(now);
  const placeholders = placeholderNodeStatusesFromFixtures();
  const placeholderNodeKeys = placeholders.map((row) => row.nodeKey);

  return {
    nodeStatuses: [
      siteHealth,
      shopifySync,
      orders,
      analytics,
      ...placeholders,
    ],
    flowStatuses: MISSION_CONTROL_FLOW_STATUS_FIXTURES,
    nowMs: now.getTime(),
    collectorCheckedAt,
    showPlaceholderNotice: placeholderNodeKeys.length > 0,
    placeholderNodeKeys,
  };
}
