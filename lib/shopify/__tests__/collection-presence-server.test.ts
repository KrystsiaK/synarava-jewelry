import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyCollections: vi.fn(),
  upsertPresence: vi.fn(),
  shopifyAdminRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    collection: { findMany: mocks.findManyCollections },
    shopifyCatalogPresenceSnapshot: { upsert: mocks.upsertPresence },
  },
}));
vi.mock("@/lib/shopify/admin", () => ({ shopifyAdminRequest: mocks.shopifyAdminRequest }));

import { scanAndSaveCollectionPresence } from "@/lib/shopify/collection-presence-server";

describe("scanAndSaveCollectionPresence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertPresence.mockResolvedValue({ id: "collections" });
    mocks.findManyCollections.mockResolvedValue([
      {
        id: "local-1",
        name: "Local kits",
        slug: "local-kits",
        shopifyCollectionId: null,
        updatedAt: new Date("2026-09-23T10:00:00.000Z"),
      },
    ]);
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        collections: {
          pageInfo: { hasNextPage: true, endCursor: "next" },
          nodes: [{
            id: "gid://shopify/Collection/41",
            title: "Remote kits",
            handle: "remote-kits",
            updatedAt: "2026-09-23T10:00:00.000Z",
          }],
        },
      })
      .mockResolvedValueOnce({
        collections: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [],
        },
      });
  });

  it("paginates Shopify, compares both catalogs, and stores the collections snapshot", async () => {
    const result = await scanAndSaveCollectionPresence("run-1");

    expect(result.map((item) => [item.kind, item.name])).toEqual([
      ["SYNARAVA_ONLY", "Local kits"],
      ["SHOPIFY_ONLY", "Remote kits"],
    ]);
    expect(mocks.shopifyAdminRequest).toHaveBeenNthCalledWith(2, expect.any(String), { after: "next" });
    expect(mocks.upsertPresence).toHaveBeenCalledWith({
      where: { id: "collections" },
      create: { id: "collections", runId: "run-1", differences: result, checkedAt: expect.any(Date) },
      update: { runId: "run-1", differences: result, checkedAt: expect.any(Date) },
    });
  });
});
