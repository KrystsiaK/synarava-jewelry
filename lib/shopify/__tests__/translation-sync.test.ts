import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bindingUpsert: vi.fn(),
  bindingFindUnique: vi.fn(),
  eventCreate: vi.fn(),
  eventUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    shopifyTranslationBinding: { upsert: mocks.bindingUpsert, findUnique: mocks.bindingFindUnique },
    translationSyncEvent: { create: mocks.eventCreate, update: mocks.eventUpdate },
  },
}));

import { ensureTranslationBinding, findTranslationBinding, recordSyncEvent, retrySyncEvent } from "@/lib/shopify/translation-sync";

beforeEach(() => vi.clearAllMocks());

describe("ensureTranslationBinding", () => {
  it("upserts on the (resourceType, entityId) compound key", async () => {
    mocks.bindingUpsert.mockResolvedValue({ id: "bind-1" });

    await ensureTranslationBinding({ resourceType: "PAGE", entityId: "page-1", shopifyResourceId: "gid://shopify/Page/1" });

    expect(mocks.bindingUpsert).toHaveBeenCalledWith({
      where: { resourceType_entityId: { resourceType: "PAGE", entityId: "page-1" } },
      create: { resourceType: "PAGE", entityId: "page-1", shopifyResourceId: "gid://shopify/Page/1" },
      update: { shopifyResourceId: "gid://shopify/Page/1" },
    });
  });
});

describe("findTranslationBinding", () => {
  it("looks up by the same compound key", async () => {
    mocks.bindingFindUnique.mockResolvedValue(null);
    await findTranslationBinding("COLLECTION", "col-1");
    expect(mocks.bindingFindUnique).toHaveBeenCalledWith({
      where: { resourceType_entityId: { resourceType: "COLLECTION", entityId: "col-1" } },
    });
  });
});

describe("recordSyncEvent", () => {
  it("stamps completedAt for a terminal status but not for PENDING", async () => {
    mocks.eventCreate.mockResolvedValue({ id: "evt-1" });

    await recordSyncEvent({ bindingId: "bind-1", locale: "pt", direction: "PUSH", status: "PENDING" });
    expect(mocks.eventCreate.mock.calls[0][0].data.completedAt).toBeNull();

    await recordSyncEvent({ bindingId: "bind-1", locale: "pt", direction: "PUSH", status: "SUCCEEDED" });
    expect(mocks.eventCreate.mock.calls[1][0].data.completedAt).toBeInstanceOf(Date);
  });

  it("stores field-level conflicts as JSON", async () => {
    mocks.eventCreate.mockResolvedValue({ id: "evt-1" });
    const fieldConflicts = [{ field: "title", local: "A", remote: "B" }];

    await recordSyncEvent({ bindingId: "bind-1", locale: "pt", direction: "RECONCILE", status: "CONFLICT", fieldConflicts });

    expect(mocks.eventCreate.mock.calls[0][0].data.fieldConflicts).toEqual(fieldConflicts);
  });
});

describe("retrySyncEvent", () => {
  it("marks PROCESSING, increments attemptCount, then SUCCEEDED on a clean retry", async () => {
    mocks.eventUpdate.mockResolvedValue({ id: "evt-1" });
    const perform = vi.fn().mockResolvedValue(undefined);

    await retrySyncEvent("evt-1", perform);

    expect(mocks.eventUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "evt-1" },
      data: { status: "PROCESSING", attemptCount: { increment: 1 } },
    });
    expect(perform).toHaveBeenCalledTimes(1);
    expect(mocks.eventUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "evt-1" },
      data: { status: "SUCCEEDED", error: null, completedAt: expect.any(Date) },
    });
  });

  it("marks FAILED with the error message and does not throw, so the caller's local copy is untouched", async () => {
    mocks.eventUpdate.mockResolvedValue({ id: "evt-1" });
    const perform = vi.fn().mockRejectedValue(new Error("Shopify: locale not enabled"));

    await expect(retrySyncEvent("evt-1", perform)).resolves.toMatchObject({ id: "evt-1" });

    expect(mocks.eventUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "evt-1" },
      data: { status: "FAILED", error: "Shopify: locale not enabled", completedAt: expect.any(Date) },
    });
  });
});
