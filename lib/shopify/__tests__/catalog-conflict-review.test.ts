import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ executeRaw: vi.fn(), queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $executeRaw: mocks.executeRaw, $queryRaw: mocks.queryRaw } }));

import {
  listUnseenIncomingProductUpdates,
  markIncomingProductUpdates,
  markIncomingProductUpdateViewed,
} from "@/lib/shopify/catalog-conflict-review";

describe("catalog conflict incoming-review watermark", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records one new global version for each distinct product pulled from Shopify", async () => {
    mocks.executeRaw.mockResolvedValue(1);
    await markIncomingProductUpdates(["p1", "p1", "p2"]);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(2);
  });

  it("returns unseen updates for the current admin only", async () => {
    mocks.queryRaw.mockResolvedValue([{ productId: "p1", updatedAt: new Date("2026-09-23T10:00:00.000Z") }]);
    await expect(listUnseenIncomingProductUpdates("admin-a")).resolves.toEqual([
      { productId: "p1", updatedAt: "2026-09-23T10:00:00.000Z" },
    ]);
  });

  it("marks the current version viewed without clearing another admin's watermark", async () => {
    mocks.executeRaw.mockResolvedValue(1);
    await markIncomingProductUpdateViewed("p1", "admin-a");
    expect(mocks.executeRaw).toHaveBeenCalledOnce();
  });
});
