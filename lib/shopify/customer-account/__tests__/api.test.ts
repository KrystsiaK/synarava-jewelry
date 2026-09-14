import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../session", () => ({
  getShopifyCustomerSession: vi.fn().mockResolvedValue({ accessToken: "customer-token" }),
}));
vi.mock("../discovery", () => ({
  getCustomerApiDiscovery: vi.fn().mockResolvedValue({ graphql_api: "https://accounts.example/graphql" }),
}));

import { findShopifyCustomerOrderForProduct, requestShopifyOrderReturn } from "../api";

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

describe("Shopify order return requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the created return on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response({
      orderRequestReturn: {
        return: { id: "gid://shopify/Return/1", status: "OPEN", name: "R1" },
        userErrors: [],
      },
    }));

    await expect(requestShopifyOrderReturn("gid://shopify/Order/1", [
      { lineItemId: "gid://shopify/LineItem/1", quantity: 1 },
    ])).resolves.toEqual({ id: "gid://shopify/Return/1", status: "OPEN", name: "R1" });
  });

  it("throws with Shopify's message when the return request is rejected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response({
      orderRequestReturn: {
        return: null,
        userErrors: [{ field: ["requestedLineItems"], message: "This item is not eligible for return." }],
      },
    }));

    await expect(requestShopifyOrderReturn("gid://shopify/Order/1", [
      { lineItemId: "gid://shopify/LineItem/1", quantity: 1 },
    ])).rejects.toThrow("This item is not eligible for return.");
  });
});
