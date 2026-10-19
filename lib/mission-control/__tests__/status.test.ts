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
  },
}));

import {
  readServiceNodeStatus,
  writeServiceNodeStatus,
} from "@/lib/mission-control/status";

describe("Mission Control Stage 2 status read/write", () => {
  beforeEach(() => {
    mocks.nodeFindUnique.mockReset();
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
});
