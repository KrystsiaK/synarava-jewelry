const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getShopifyBuyerIp: vi.fn(),
  shopifyStorefrontRequest: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/shopify/request-context", () => ({
  getShopifyBuyerIp: mocks.getShopifyBuyerIp,
}));

vi.mock("@/lib/shopify/storefront", () => ({
  shopifyStorefrontRequest: mocks.shopifyStorefrontRequest,
}));

vi.mock("@/lib/i18n/server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

import { getShopifyCartLineQuantity } from "@/lib/shopify/cart";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({
    get: vi.fn(() => ({ value: "gid://shopify/Cart/1" })),
  });
  mocks.getShopifyBuyerIp.mockResolvedValue("203.0.113.4");
});

describe("getShopifyCartLineQuantity", () => {
  it("returns null without loading Shopify when no cart cookie exists", async () => {
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => undefined) });

    await expect(getShopifyCartLineQuantity("line-1")).resolves.toBeNull();
    expect(mocks.shopifyStorefrontRequest).not.toHaveBeenCalled();
  });

  it("loads only line ids and quantities instead of the full cart view model", async () => {
    mocks.shopifyStorefrontRequest.mockResolvedValue({
      cart: {
        lines: {
          nodes: [
            { id: "line-1", quantity: 2 },
            { id: "line-2", quantity: 4 },
          ],
        },
      },
    });

    await expect(getShopifyCartLineQuantity("line-2")).resolves.toBe(4);

    const [query, variables, options] = mocks.shopifyStorefrontRequest.mock.calls[0];
    expect(query).toContain("nodes { id quantity }");
    expect(query).not.toContain("checkoutUrl");
    expect(query).not.toContain("merchandise");
    expect(variables).toEqual({ cartId: "gid://shopify/Cart/1" });
    expect(options).toEqual({ buyerIp: "203.0.113.4" });
  });
});
