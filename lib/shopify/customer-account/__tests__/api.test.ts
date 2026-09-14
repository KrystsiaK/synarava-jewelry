import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../session", () => ({
  getShopifyCustomerSession: vi.fn().mockResolvedValue({ accessToken: "customer-token" }),
}));
vi.mock("../discovery", () => ({
  getCustomerApiDiscovery: vi.fn().mockResolvedValue({ graphql_api: "https://accounts.example/graphql" }),
}));

import { findShopifyCustomerOrderForProduct } from "../api";

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Shopify customer purchase lookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("continues through every order page before deciding a purchase is unverified", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ customer: { orders: {
        nodes: [{ id: "order-1", lineItems: { nodes: [{ productId: "product-other" }], pageInfo: { hasNextPage: false, endCursor: null } } }],
        pageInfo: { hasNextPage: true, endCursor: "orders-2" },
      } } }))
      .mockResolvedValueOnce(response({ customer: { orders: {
        nodes: [{ id: "order-2", lineItems: { nodes: [{ productId: "product-target" }], pageInfo: { hasNextPage: false, endCursor: null } } }],
        pageInfo: { hasNextPage: false, endCursor: null },
      } } }));

    await expect(findShopifyCustomerOrderForProduct("product-target")).resolves.toBe("order-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("continues through line-item pages within a large order", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ customer: { orders: {
        nodes: [{ id: "order-large", lineItems: { nodes: [{ productId: "product-other" }], pageInfo: { hasNextPage: true, endCursor: "items-2" } } }],
        pageInfo: { hasNextPage: false, endCursor: null },
      } } }))
      .mockResolvedValueOnce(response({ order: { lineItems: {
        nodes: [{ productId: "product-target" }],
        pageInfo: { hasNextPage: false, endCursor: null },
      } } }));

    await expect(findShopifyCustomerOrderForProduct("product-target")).resolves.toBe("order-large");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
