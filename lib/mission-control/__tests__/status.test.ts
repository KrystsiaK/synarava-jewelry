import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  nodeFindUnique: vi.fn(),
  nodeFindFirst: vi.fn(),
  nodeUpsert: vi.fn(),
  flowFindUnique: vi.fn(),
  flowUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    serviceNodeStatus: {
      findUnique: mocks.nodeFindUnique,
      findFirst: mocks.nodeFindFirst,
      upsert: mocks.nodeUpsert,
    },
    serviceFlowStatus: {
      findUnique: mocks.flowFindUnique,
      upsert: mocks.flowUpsert,
    },
  },
}));

import {
  readLatestCollectorCheckedAt,
  readServiceNodeStatus,
  writeServiceNodeStatus,
} from "@/lib/mission-control/status";

describe("Mission Control Stage 2 status read/write", () => {
  beforeEach(() => {
    mocks.nodeFindUnique.mockReset();
    mocks.nodeFindFirst.mockReset();
    mocks.nodeUpsert.mockReset();
    mocks.flowFindUnique.mockReset();
    mocks.flowUpsert.mockReset();
  });

  it("writes then reads a node status via upsert/findUnique (mocked Prisma)", async () => {
    const checkedAt = new Date("2026-10-19T14:30:00.000Z");
    const updatedAt = new Date("2026-10-19T14:30:01.000Z");
    const stored = {
      nodeKey: "site-health",
      level: "ok" as const,
      message: "pong",
      counters: { latencyMs: 12 },
      href: "/health",
      checkedAt,
      updatedAt,
    };

    mocks.nodeUpsert.mockResolvedValueOnce(stored);
    mocks.nodeFindUnique.mockResolvedValueOnce(stored);

    const written = await writeServiceNodeStatus({
      nodeKey: "site-health",
      level: "ok",
      message: "pong",
      counters: { latencyMs: 12 },
      href: "/health",
      checkedAt,
    });

    expect(mocks.nodeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nodeKey: "site-health" },
        create: expect.objectContaining({
          nodeKey: "site-health",
          level: "ok",
          checkedAt,
        }),
        update: expect.objectContaining({
          level: "ok",
          checkedAt,
        }),
      }),
    );
    expect(written).toEqual(stored);

    const read = await readServiceNodeStatus("site-health");
    expect(mocks.nodeFindUnique).toHaveBeenCalledWith({
      where: { nodeKey: "site-health" },
    });
    expect(read).toEqual(stored);
  });

  it("reads the latest collector checkedAt across live keys", async () => {
    const checkedAt = new Date("2026-10-19T14:30:00.000Z");
    mocks.nodeFindFirst.mockResolvedValueOnce({ checkedAt });

    const latest = await readLatestCollectorCheckedAt([
      "site-health",
      "shopify-sync",
      "orders",
    ]);

    expect(mocks.nodeFindFirst).toHaveBeenCalledWith({
      where: { nodeKey: { in: ["site-health", "shopify-sync", "orders"] } },
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    });
    expect(latest).toEqual(checkedAt);
  });

  it("returns null when the collector has never written", async () => {
    mocks.nodeFindFirst.mockResolvedValueOnce(null);
    await expect(readLatestCollectorCheckedAt(["site-health"])).resolves.toBeNull();
    await expect(readLatestCollectorCheckedAt([])).resolves.toBeNull();
    expect(mocks.nodeFindFirst).toHaveBeenCalledTimes(1);
  });
});
