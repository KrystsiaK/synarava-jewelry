import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@/lib/shopify/admin", () => ({
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyAdminRequest: mocks.request,
}));

import { fetchInventoryLevels } from "@/lib/shopify/inventory-levels";

beforeEach(() => vi.clearAllMocks());

describe("fetchInventoryLevels", () => {
  it("reads quantities with inventory access without requesting the restricted location name", async () => {
    mocks.request.mockImplementation(async (query: string) => {
      if (/location\s*\{[^}]*\bname\b/.test(query)) {
        throw new Error("Access denied for name field. Required access: read_locations.");
      }
      return {
        inventoryItem: {
          inventoryLevels: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [{ location: { id: "gid://shopify/Location/1" }, quantities: [
              { name: "available", quantity: 1 },
              { name: "committed", quantity: 0 },
              { name: "on_hand", quantity: 1 },
            ] }],
          },
        },
      };
    });

    await expect(fetchInventoryLevels("gid://shopify/InventoryItem/1")).resolves.toEqual([
      { location: { id: "gid://shopify/Location/1" }, quantities: [
        { name: "available", quantity: 1 },
        { name: "committed", quantity: 0 },
        { name: "on_hand", quantity: 1 },
      ] },
    ]);
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
});
