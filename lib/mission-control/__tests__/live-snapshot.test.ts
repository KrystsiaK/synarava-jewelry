import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mission-control/providers/site-health", () => ({
  getSiteHealthStatus: vi.fn(async () => ({
    nodeKey: "site-health",
    level: "ok",
    message: "pong",
    counters: { latencyMs: 1 },
    href: "/api/health",
    checkedAt: new Date("2026-10-19T22:00:00.000Z"),
    updatedAt: new Date("2026-10-19T22:00:00.000Z"),
  })),
}));

vi.mock("@/lib/mission-control/providers/shopify-sync", () => ({
  getShopifySyncStatus: vi.fn(async () => ({
    nodeKey: "shopify-sync",
    level: "ok",
    message: "fresh",
    counters: { ageHours: 1 },
    href: "/admin/products",
    checkedAt: new Date("2026-10-19T22:00:00.000Z"),
    updatedAt: new Date("2026-10-19T22:00:00.000Z"),
  })),
}));

vi.mock("@/lib/mission-control/providers/orders", () => ({
  getOrdersStatus: vi.fn(async () => ({
    nodeKey: "orders",
    level: "ok",
    message: "counters",
    counters: { paid: 1, cancelled: 0, failedRecent: 0 },
    href: "/admin/orders",
    checkedAt: new Date("2026-10-19T22:00:00.000Z"),
    updatedAt: new Date("2026-10-19T22:00:00.000Z"),
  })),
}));

const COLLECTOR_AT = new Date("2026-10-19T21:55:00.000Z");

vi.mock("@/lib/mission-control/status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mission-control/status")>();
  return {
    ...actual,
    readLatestCollectorCheckedAt: vi.fn(async () => COLLECTOR_AT),
  };
});

import {
  LIVE_NODE_KEYS,
  loadMissionControlSnapshot,
  placeholderNodeStatusesFromFixtures,
} from "@/lib/mission-control/live-snapshot";
import { MISSION_CONTROL_NODE_STATUS_FIXTURES } from "@/lib/mission-control/fixtures";
import { readLatestCollectorCheckedAt } from "@/lib/mission-control/status";

describe("Mission Control Stage 4 live snapshot", () => {
  it("exposes exactly three live node keys", () => {
    expect([...LIVE_NODE_KEYS].sort()).toEqual(
      ["orders", "shopify-sync", "site-health"].sort(),
    );
  });

  it("keeps fixture statuses only for non-live placeholders", () => {
    const placeholders = placeholderNodeStatusesFromFixtures(
      MISSION_CONTROL_NODE_STATUS_FIXTURES,
    );
    const keys = placeholders.map((row) => row.nodeKey).sort();
    expect(keys).toEqual(["db", "products", "sentry"]);
    expect(keys.some((key) => LIVE_NODE_KEYS.includes(key as never))).toBe(
      false,
    );
  });

  it("merges live providers with placeholders; notice stays for placeholders", async () => {
    const snapshot = await loadMissionControlSnapshot();
    const keys = snapshot.nodeStatuses.map((row) => row.nodeKey).sort();

    expect(keys).toContain("site-health");
    expect(keys).toContain("shopify-sync");
    expect(keys).toContain("orders");
    expect(keys).toContain("sentry");
    expect(snapshot.showPlaceholderNotice).toBe(true);
    expect(snapshot.placeholderNodeKeys).toEqual(
      expect.arrayContaining(["sentry", "db", "products"]),
    );
    expect(snapshot.collectorCheckedAt).toEqual(COLLECTOR_AT);
    expect(readLatestCollectorCheckedAt).toHaveBeenCalledWith(LIVE_NODE_KEYS);
  });
});
