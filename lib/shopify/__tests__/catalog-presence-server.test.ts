import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyProducts: vi.fn(),
  upsertPresence: vi.fn(),
  shopifyAdminRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: { findMany: mocks.findManyProducts },
    shopifyCatalogPresenceSnapshot: { upsert: mocks.upsertPresence },
  },
}));
vi.mock("@/lib/shopify/admin", () => ({ shopifyAdminRequest: mocks.shopifyAdminRequest }));

import { scanAndSaveCatalogPresence } from "@/lib/shopify/catalog-presence-server";

describe("scanAndSaveCatalogPresence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertPresence.mockResolvedValue({ id: "catalog" });
    mocks.findManyProducts.mockResolvedValue([
      {
        id: "local-1",
        name: "Local bracelet",
        slug: "local-bracelet",
        sku: "LOCAL-1",
        shopifyProductId: null,
        updatedAt: new Date("2026-09-23T10:00:00.000Z"),
      },
    ]);
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        products: {
          pageInfo: { hasNextPage: true, endCursor: "next" },
          nodes: [{
            id: "gid://shopify/Product/41",
            title: "Remote necklace",
            handle: "remote-necklace",
            updatedAt: "2026-09-23T10:00:00.000Z",
            variants: { nodes: [{ sku: "REMOTE-41" }] },
          }],
        },
      })
      .mockResolvedValueOnce({
        products: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [],
        },
      });
  });

  it("paginates Shopify, compares both catalogs, and stores the snapshot on the reconcile run", async () => {
    const result = await scanAndSaveCatalogPresence("run-1");

    expect(result.map((item) => [item.kind, item.name])).toEqual([
      ["SYNARAVA_ONLY", "Local bracelet"],
      ["SHOPIFY_ONLY", "Remote necklace"],
    ]);
    expect(mocks.shopifyAdminRequest).toHaveBeenNthCalledWith(2, expect.any(String), { after: "next" });
    expect(mocks.upsertPresence).toHaveBeenCalledWith({
      where: { id: "catalog" },
      create: { id: "catalog", runId: "run-1", differences: result, checkedAt: expect.any(Date) },
      update: { runId: "run-1", differences: result, checkedAt: expect.any(Date) },
    });
  });
});
