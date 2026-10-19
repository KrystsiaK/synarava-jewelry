import {
  MISSION_CONTROL_FLOW_STATUS_FIXTURES,
  MISSION_CONTROL_NODE_STATUS_FIXTURES,
} from "@/lib/mission-control/fixtures";
import { getOrdersStatus } from "@/lib/mission-control/providers/orders";
import { getShopifySyncStatus } from "@/lib/mission-control/providers/shopify-sync";
import { getSiteHealthStatus } from "@/lib/mission-control/providers/site-health";
import type {
  ServiceFlowStatusRecord,
  ServiceNodeStatusRecord,
} from "@/lib/mission-control/status";

/** Stage 4 live nodes — computed at request time; not persisted. */
export const LIVE_NODE_KEYS = ["site-health", "shopify-sync", "orders"] as const;

export type LiveNodeKey = (typeof LIVE_NODE_KEYS)[number];

const LIVE_KEY_SET: ReadonlySet<string> = new Set(LIVE_NODE_KEYS);

export type MissionControlSnapshot = {
  nodeStatuses: ServiceNodeStatusRecord[];
  flowStatuses: ServiceFlowStatusRecord[];
  nowMs: number;
  /** True while any catalog node still uses fixture/placeholder data. */
  showPlaceholderNotice: boolean;
  placeholderNodeKeys: string[];
};

export function placeholderNodeStatusesFromFixtures(
  fixtures: readonly ServiceNodeStatusRecord[] = MISSION_CONTROL_NODE_STATUS_FIXTURES,
): ServiceNodeStatusRecord[] {
  return fixtures.filter((row) => !LIVE_KEY_SET.has(row.nodeKey));
}

/**
 * Merge request-time live providers with fixture placeholders.
 * Does not read/write `ServiceNodeStatus` / `ServiceFlowStatus` tables.
 */
export async function loadMissionControlSnapshot(
  now: Date = new Date(),
): Promise<MissionControlSnapshot> {
  const [siteHealth, shopifySync, orders] = await Promise.all([
    getSiteHealthStatus({ now }),
    getShopifySyncStatus({ now }),
    getOrdersStatus({ now }),
  ]);

  const placeholders = placeholderNodeStatusesFromFixtures();
  const placeholderNodeKeys = placeholders.map((row) => row.nodeKey);

  return {
    nodeStatuses: [siteHealth, shopifySync, orders, ...placeholders],
    flowStatuses: MISSION_CONTROL_FLOW_STATUS_FIXTURES,
    nowMs: now.getTime(),
    showPlaceholderNotice: placeholderNodeKeys.length > 0,
    placeholderNodeKeys,
  };
}
