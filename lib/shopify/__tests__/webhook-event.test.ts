import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { productSyncEvent: { create: mocks.create, updateMany: mocks.updateMany, findUnique: mocks.findUnique } },
}));

import { claimWebhookEvent } from "../webhook-event";

function duplicateError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

const baseParams = {
  webhookId: "wh-1",
  shopifyProductId: "gid://shopify/Product/1",
  direction: "PULL" as const,
  topic: "products/update",
  payload: {},
};

describe("claimWebhookEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a fresh event on first delivery", async () => {
    mocks.create.mockResolvedValue({ id: "event-1" });

    const event = await claimWebhookEvent(baseParams);

    expect(event).toEqual({ id: "event-1" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("reclaims a FAILED event on retry, incrementing attemptCount", async () => {
    mocks.create.mockRejectedValue(duplicateError());
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUnique.mockResolvedValue({ id: "event-1" });

    const event = await claimWebhookEvent(baseParams);

    expect(event).toEqual({ id: "event-1" });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ shopifyWebhookId: "wh-1" }),
      data: expect.objectContaining({ status: "PROCESSING", attemptCount: { increment: 1 } }),
    }));
  });

  it("refuses to reclaim a SUCCEEDED event", async () => {
    mocks.create.mockRejectedValue(duplicateError());
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const event = await claimWebhookEvent(baseParams);

    expect(event).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("refuses to reclaim a PROCESSING event still inside its lease", async () => {
    mocks.create.mockRejectedValue(duplicateError());
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const event = await claimWebhookEvent(baseParams);

    expect(event).toBeNull();
  });
});
