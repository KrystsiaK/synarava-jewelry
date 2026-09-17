const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getShopifyBuyerIp: vi.fn(),
  getRequestLocale: vi.fn(),
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
  getRequestLocale: mocks.getRequestLocale,
}));

import { addShopifyProductToCart, getShopifyCartLineQuantity, getShopifyCartViewModel } from "@/lib/shopify/cart";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({
    get: vi.fn(() => ({ value: "gid://shopify/Cart/1" })),
  });
  mocks.getShopifyBuyerIp.mockResolvedValue("203.0.113.4");
  mocks.getRequestLocale.mockResolvedValue("en");
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
          pageInfo: { hasNextPage: false, endCursor: null },
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
    expect(variables).toEqual({ cartId: "gid://shopify/Cart/1", after: null });
    expect(options).toEqual({ buyerIp: "203.0.113.4" });
  });

  it("pages past the first 100 lines to find a line beyond the first page (REV-12)", async () => {
    mocks.shopifyStorefrontRequest
      .mockResolvedValueOnce({
        cart: { lines: { pageInfo: { hasNextPage: true, endCursor: "cursor-1" }, nodes: [{ id: "line-1", quantity: 1 }] } },
      })
      .mockResolvedValueOnce({
        cart: { lines: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ id: "line-101", quantity: 9 }] } },
      });

    await expect(getShopifyCartLineQuantity("line-101")).resolves.toBe(9);
    expect(mocks.shopifyStorefrontRequest).toHaveBeenCalledTimes(2);
    const [, secondCallVariables] = mocks.shopifyStorefrontRequest.mock.calls[1];
    expect(secondCallVariables).toEqual({ cartId: "gid://shopify/Cart/1", after: "cursor-1" });
  });

  it("requests translated cart product copy in the active locale", async () => {
    mocks.getRequestLocale.mockResolvedValue("pt");
    mocks.shopifyStorefrontRequest.mockResolvedValue({
      cart: {
        id: "cart-1",
        checkoutUrl: "https://checkout.example",
        totalQuantity: 0,
        cost: { subtotalAmount: { amount: "0.00", currencyCode: "EUR" } },
        lines: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      },
    });

    await getShopifyCartViewModel();

    const [query, variables] = mocks.shopifyStorefrontRequest.mock.calls[0];
    expect(query).toContain("@inContext(language: $language)");
    expect(variables).toEqual({ cartId: "gid://shopify/Cart/1", language: "PT_PT" });
  });

  it("collects every line past the first page instead of truncating the cart at 100 (REV-12)", async () => {
    const merchandise = {
      id: "gid://shopify/ProductVariant/1",
      sku: "SKU-1",
      title: "Default Title",
      price: { amount: "10.00", currencyCode: "EUR" },
      image: null,
      quantityAvailable: 5,
      currentlyNotInStock: false,
      product: { handle: "ring", title: "Ring", featuredImage: null },
    };
    const line = (id: string) => ({
      id,
      quantity: 1,
      cost: { totalAmount: { amount: "10.00", currencyCode: "EUR" } },
      merchandise,
    });

    mocks.shopifyStorefrontRequest
      .mockResolvedValueOnce({
        cart: {
          id: "cart-1",
          checkoutUrl: "https://checkout.example",
          totalQuantity: 101,
          cost: { subtotalAmount: { amount: "1010.00", currencyCode: "EUR" } },
          lines: { pageInfo: { hasNextPage: true, endCursor: "cursor-1" }, nodes: [line("line-1")] },
        },
      })
      .mockResolvedValueOnce({
        cart: { lines: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [line("line-101")] } },
      });

    const result = await getShopifyCartViewModel();

    expect(result.items.map((item) => item.id)).toEqual(["line-1", "line-101"]);
    expect(mocks.shopifyStorefrontRequest).toHaveBeenCalledTimes(2);
  });
});

describe("addShopifyProductToCart", () => {
  const existingCart = {
    id: "gid://shopify/Cart/1",
    checkoutUrl: "https://checkout.example",
    totalQuantity: 1,
    cost: { subtotalAmount: { amount: "10.00", currencyCode: "EUR" } },
    lines: { nodes: [] },
  };

  it("surfaces Shopify's cart warnings instead of dropping them (REV-09)", async () => {
    mocks.shopifyStorefrontRequest
      .mockResolvedValueOnce({ cart: existingCart })
      .mockResolvedValueOnce({
        cartLinesAdd: {
          cart: existingCart,
          userErrors: [],
          warnings: [{ message: "Only 1 left — we added what's available." }],
        },
      });

    const result = await addShopifyProductToCart(
      "birch-bracelet",
      1,
      "gid://shopify/ProductVariant/1",
    );

    expect(result.warnings).toEqual(["Only 1 left — we added what's available."]);
    expect(result.cart).toEqual(existingCart);
  });

  it("returns no warnings for a clean mutation", async () => {
    mocks.shopifyStorefrontRequest
      .mockResolvedValueOnce({ cart: existingCart })
      .mockResolvedValueOnce({ cartLinesAdd: { cart: existingCart, userErrors: [], warnings: [] } });

    const result = await addShopifyProductToCart(
      "birch-bracelet",
      1,
      "gid://shopify/ProductVariant/1",
    );

    expect(result.warnings).toEqual([]);
  });
});
