import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    shopifyWebhookDelivery: {
      count: mocks.count,
    },
  },
}));

import { getOrdersStatus } from "@/lib/mission-control/providers/orders";

describe("getOrdersStatus", () => {
  const now = new Date("2026-10-19T22:00:00.000Z");

  beforeEach(() => {
    mocks.count.mockReset();
  });

  it("returns ok when order webhook counters load with no recent failures", async () => {
    mocks.count
      .mockResolvedValueOnce(12) // paid succeeded
      .mockResolvedValueOnce(2) // cancelled succeeded
      .mockResolvedValueOnce(0); // failed recent

    const status = await getOrdersStatus({ now });

    expect(status).toMatchObject({
      nodeKey: "orders",
      level: "ok",
      href: "/admin/orders",
      counters: { paid: 12, cancelled: 2, failedRecent: 0 },
    });
  });

  it("returns warn when some recent deliveries failed", async () => {
    mocks.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const status = await getOrdersStatus({ now });
    expect(status.level).toBe("warn");
    expect(status.message).toMatch(/fail/i);
  });

  it("returns down when recent failures dominate successes", async () => {
    mocks.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(6);

    const status = await getOrdersStatus({ now });
    expect(status.level).toBe("down");
  });

  it("returns unknown when Prisma count throws", async () => {
    mocks.count.mockRejectedValueOnce(new Error("db down"));

    const status = await getOrdersStatus({ now });
    expect(status.level).toBe("unknown");
    expect(status.message).toMatch(/unavailable|unknown|error/i);
  });
});
