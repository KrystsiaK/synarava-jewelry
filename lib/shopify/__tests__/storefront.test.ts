import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shopify/config", () => ({
  getShopifyStorefrontConfig: () => ({
    domain: "shop.myshopify.com",
    privateToken: "token",
    apiVersion: "2026-07",
    endpoint: "https://shop.myshopify.com/api/2026-07/graphql.json",
  }),
}));

import { shopifyStorefrontRequest } from "../storefront";

describe("shopifyStorefrontRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("bounds every request with an abort signal so a stalled Shopify can't hang the caller forever", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await shopifyStorefrontRequest("query { ok }");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
