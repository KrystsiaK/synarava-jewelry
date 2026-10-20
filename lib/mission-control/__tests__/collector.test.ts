import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  nodeFindUnique: vi.fn(),
  nodeUpsert: vi.fn(),
  flowFindUnique: vi.fn(),
  flowUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    serviceNodeStatus: {
      findUnique: mocks.nodeFindUnique,
      upsert: mocks.nodeUpsert,
    },
    serviceFlowStatus: {
      findUnique: mocks.flowFindUnique,
      upsert: mocks.flowUpsert,
    },
    $disconnect: vi.fn(),
  },
}));

import { shouldAlertOnLevelChange } from "@/lib/mission-control/collector/alerts";
import { runCollectorOnce } from "@/lib/mission-control/collector/run-once";
import { sendTelegramAlert } from "@/lib/mission-control/collector/telegram";
import type { ServiceNodeStatusRecord } from "@/lib/mission-control/status";

function node(
  partial: Pick<ServiceNodeStatusRecord, "nodeKey" | "level"> &
    Partial<ServiceNodeStatusRecord>,
): ServiceNodeStatusRecord {
  const checkedAt = partial.checkedAt ?? new Date("2026-10-19T22:00:00.000Z");
  return {
    message: partial.message ?? null,
    counters: partial.counters ?? null,
    href: partial.href ?? null,
    checkedAt,
    updatedAt: partial.updatedAt ?? checkedAt,
    ...partial,
  };
}

describe("shouldAlertOnLevelChange", () => {
  it("alerts on ok→down", () => {
    expect(shouldAlertOnLevelChange("ok", "down")).toBe(true);
  });

  it("does not alert on down→down", () => {
    expect(shouldAlertOnLevelChange("down", "down")).toBe(false);
  });

  it("does not alert on ok→ok", () => {
    expect(shouldAlertOnLevelChange("ok", "ok")).toBe(false);
  });

  it("alerts on null→warn (first observation into warn)", () => {
    expect(shouldAlertOnLevelChange(null, "warn")).toBe(true);
  });

  it("does not alert on down→ok", () => {
    expect(shouldAlertOnLevelChange("down", "ok")).toBe(false);
  });
});

describe("sendTelegramAlert", () => {
  it("skips when token/chat missing", async () => {
    const fetchFn = vi.fn();
    const result = await sendTelegramAlert("hi", {
      fetchFn,
      botToken: null,
      chatId: null,
    });
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: "not_configured",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns ok:false on HTTP failure without throwing", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const result = await sendTelegramAlert("hi", {
      fetchFn,
      botToken: "token",
      chatId: "chat",
    });
    expect(result.ok).toBe(false);
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

describe("runCollectorOnce", () => {
  const now = new Date("2026-10-19T22:30:00.000Z");

  beforeEach(() => {
    mocks.nodeFindUnique.mockReset();
    mocks.nodeUpsert.mockReset();
    mocks.flowFindUnique.mockReset();
    mocks.flowUpsert.mockReset();
    mocks.flowFindUnique.mockResolvedValue(null);
    mocks.flowUpsert.mockImplementation(async (args: { create: unknown }) => ({
      ...(args.create as object),
      updatedAt: now,
    }));
    mocks.nodeUpsert.mockImplementation(async (args: { create: unknown }) => ({
      ...(args.create as object),
      updatedAt: now,
    }));
  });

  it("ok→down alerts once and upserts nodes", async () => {
    mocks.nodeFindUnique.mockImplementation(
      async ({ where }: { where: { nodeKey: string } }) => {
        if (where.nodeKey === "site-health") {
          return node({ nodeKey: "site-health", level: "ok" });
        }
        return null;
      },
    );

    const sendTelegram = vi.fn().mockResolvedValue({
      ok: true,
      skipped: false,
    });

    const result = await runCollectorOnce({
      now,
      env: {
        APP_URL: "https://shop.example",
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_CHAT_ID: "chat",
      },
      getSiteHealthStatus: async () =>
        node({
          nodeKey: "site-health",
          level: "down",
          message: "health unavailable (503)",
          href: "/api/health",
        }),
      getShopifySyncStatus: async () =>
        node({ nodeKey: "shopify-sync", level: "ok", message: "fresh" }),
      getOrdersStatus: async () =>
        node({ nodeKey: "orders", level: "ok", message: "ok" }),
      sendTelegramAlert: sendTelegram,
    });

    expect(mocks.nodeUpsert).toHaveBeenCalledTimes(3);
    expect(result.nodesUpserted).toEqual([
      "site-health",
      "shopify-sync",
      "orders",
    ]);
    expect(result.alertsSent).toEqual(["site-health"]);
    expect(sendTelegram).toHaveBeenCalledOnce();
    expect(sendTelegram.mock.calls[0][0]).toContain("Site health → down");
    expect(sendTelegram.mock.calls[0][0]).toContain(
      "https://shop.example/admin/mission-control",
    );
    expect(mocks.flowUpsert).toHaveBeenCalled();
  });

  it("down→down does not alert", async () => {
    mocks.nodeFindUnique.mockResolvedValue(
      node({ nodeKey: "site-health", level: "down" }),
    );

    const sendTelegram = vi.fn();

    const result = await runCollectorOnce({
      now,
      env: {
        APP_URL: "https://shop.example",
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_CHAT_ID: "chat",
      },
      getSiteHealthStatus: async () =>
        node({ nodeKey: "site-health", level: "down" }),
      getShopifySyncStatus: async () =>
        node({ nodeKey: "shopify-sync", level: "down" }),
      getOrdersStatus: async () => node({ nodeKey: "orders", level: "down" }),
      sendTelegramAlert: sendTelegram,
    });

    expect(result.alertsSent).toEqual([]);
    expect(sendTelegram).not.toHaveBeenCalled();
    expect(mocks.nodeUpsert).toHaveBeenCalledTimes(3);
  });

  it("ok→ok does not alert", async () => {
    mocks.nodeFindUnique.mockResolvedValue(
      node({ nodeKey: "site-health", level: "ok" }),
    );
    const sendTelegram = vi.fn();

    const result = await runCollectorOnce({
      now,
      env: {
        APP_URL: "https://shop.example",
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_CHAT_ID: "chat",
      },
      getSiteHealthStatus: async () =>
        node({ nodeKey: "site-health", level: "ok" }),
      getShopifySyncStatus: async () =>
        node({ nodeKey: "shopify-sync", level: "ok" }),
      getOrdersStatus: async () => node({ nodeKey: "orders", level: "ok" }),
      sendTelegramAlert: sendTelegram,
    });

    expect(result.alertsSent).toEqual([]);
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("Telegram failure does not crash the run", async () => {
    mocks.nodeFindUnique.mockResolvedValue(null);

    const sendTelegram = vi.fn().mockResolvedValue({
      ok: false,
      skipped: false,
      error: "telegram HTTP 500",
    });
    const log = vi.fn();

    const result = await runCollectorOnce({
      now,
      env: {
        APP_URL: "https://shop.example",
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_CHAT_ID: "chat",
      },
      getSiteHealthStatus: async () =>
        node({ nodeKey: "site-health", level: "down" }),
      getShopifySyncStatus: async () =>
        node({ nodeKey: "shopify-sync", level: "ok" }),
      getOrdersStatus: async () => node({ nodeKey: "orders", level: "ok" }),
      sendTelegramAlert: sendTelegram,
      log,
    });

    expect(result.nodesUpserted).toHaveLength(3);
    expect(result.alertsFailed).toEqual(["site-health"]);
    expect(result.alertsSent).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("telegram alert failed for site-health"),
    );
  });

  it("calls node and flow upserts for live providers", async () => {
    mocks.nodeFindUnique.mockResolvedValue(null);

    await runCollectorOnce({
      now,
      env: { APP_URL: "https://shop.example" },
      getSiteHealthStatus: async () =>
        node({ nodeKey: "site-health", level: "ok" }),
      getShopifySyncStatus: async () =>
        node({ nodeKey: "shopify-sync", level: "ok" }),
      getOrdersStatus: async () => node({ nodeKey: "orders", level: "ok" }),
      sendTelegramAlert: vi.fn(),
    });

    expect(mocks.nodeUpsert).toHaveBeenCalledTimes(3);
    expect(mocks.flowUpsert.mock.calls.length).toBeGreaterThan(0);
    const busKeys = mocks.flowUpsert.mock.calls.map(
      (call: [{ where: { busKey: string } }]) => call[0].where.busKey,
    );
    expect(busKeys).toEqual(
      expect.arrayContaining([
        "site_to_db",
        "shopify_to_products",
        "orders_pulse",
      ]),
    );
  });
});
