import type {
  ServiceFlowStatusRecord,
  ServiceNodeStatusRecord,
} from "@/lib/mission-control/status";

const CHECKED_AT = new Date("2026-10-19T21:00:00.000Z");
const UPDATED_AT = new Date("2026-10-19T21:00:01.000Z");

/**
 * Stage 3 local/render fixtures — no database.
 * Collector (Stage 5) will replace these with real `status.ts` reads.
 */
export const MISSION_CONTROL_NODE_STATUS_FIXTURES: ServiceNodeStatusRecord[] = [
  {
    nodeKey: "site-health",
    level: "ok",
    message: "pong",
    counters: { latencyMs: 18 },
    href: "/health",
    checkedAt: CHECKED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    nodeKey: "db",
    level: "ok",
    message: "reachable",
    counters: null,
    href: null,
    checkedAt: CHECKED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    nodeKey: "shopify-sync",
    level: "warn",
    message: "last sync stale",
    counters: null,
    href: "/admin/products",
    checkedAt: CHECKED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    nodeKey: "products",
    level: "ok",
    message: null,
    counters: null,
    href: "/admin/products",
    checkedAt: CHECKED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    nodeKey: "orders",
    level: "unknown",
    message: "collector not wired",
    counters: null,
    href: "/admin/orders",
    checkedAt: CHECKED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    nodeKey: "sentry",
    level: "down",
    message: "not connected",
    counters: null,
    href: "https://sentry.io",
    checkedAt: CHECKED_AT,
    updatedAt: UPDATED_AT,
  },
];

/** `now` for fixtures is fixed so “fresh” edges stay deterministic in tests. */
export const MISSION_CONTROL_FIXTURE_NOW = new Date("2026-10-19T21:02:00.000Z");

export const MISSION_CONTROL_FLOW_STATUS_FIXTURES: ServiceFlowStatusRecord[] = [
  {
    busKey: "site_to_db",
    lastFlowAt: new Date("2026-10-19T21:01:30.000Z"),
    level: "ok",
    updatedAt: UPDATED_AT,
  },
  {
    busKey: "shopify_to_products",
    lastFlowAt: new Date("2026-10-19T20:00:00.000Z"),
    level: "warn",
    updatedAt: UPDATED_AT,
  },
  {
    busKey: "site_to_sentry",
    lastFlowAt: null,
    level: "down",
    updatedAt: UPDATED_AT,
  },
];
