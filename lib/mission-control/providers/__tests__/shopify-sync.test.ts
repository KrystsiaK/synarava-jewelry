import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    productSyncEvent: {
      findFirst: mocks.findFirst,
    },
  },
}));

import { getShopifySyncStatus } from "@/lib/mission-control/providers/shopify-sync";

describe("getShopifySyncStatus", () => {
  const now = new Date("2026-10-19T22:00:00.000Z");

  beforeEach(() => {
    mocks.findFirst.mockReset();
  });

  it("returns ok when last SUCCEEDED sync is fresh", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      completedAt: new Date("2026-10-19T20:00:00.000Z"),
      status: "SUCCEEDED",
    });

    const status = await getShopifySyncStatus({ now });

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "SUCCEEDED", completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      }),
    );
    expect(status).toMatchObject({
      nodeKey: "shopify-sync",
      level: "ok",
      href: "/admin/products",
    });
    expect(status.counters).toMatchObject({
      ageHours: expect.any(Number),
    });
  });

  it("returns warn when last sync is stale but within the down window", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      completedAt: new Date("2026-10-18T10:00:00.000Z"),
      status: "SUCCEEDED",
    });

    const status = await getShopifySyncStatus({ now });
    expect(status.level).toBe("warn");
    expect(status.message).toMatch(/stale/i);
  });

  it("returns down when last sync is older than the down threshold", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      completedAt: new Date("2026-10-10T22:00:00.000Z"),
      status: "SUCCEEDED",
    });

    const status = await getShopifySyncStatus({ now });
    expect(status.level).toBe("down");
    expect(status.message).toMatch(/stale|overdue|old/i);
  });

  it("returns unknown when no successful sync exists or Prisma throws", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);
    const empty = await getShopifySyncStatus({ now });
    expect(empty.level).toBe("unknown");
    expect(empty.message).toMatch(/no successful/i);

    mocks.findFirst.mockRejectedValueOnce(new Error("db down"));
    const errored = await getShopifySyncStatus({ now });
    expect(errored.level).toBe("unknown");
  });
});
