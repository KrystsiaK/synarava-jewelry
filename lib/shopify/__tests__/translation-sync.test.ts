import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bindingUpsert: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    shopifyTranslationBinding: { upsert: mocks.bindingUpsert },
    translationSyncEvent: { create: mocks.eventCreate },
  },
}));

import { ensureTranslationBinding, recordSyncEvent } from "@/lib/shopify/translation-sync";

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
