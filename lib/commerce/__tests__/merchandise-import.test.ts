const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  addShopifyMerchandiseLinesToCart: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: { findFirst: vi.fn() },
    productVariant: { findMany: mocks.findMany },
  },
}));

vi.mock("@/lib/shopify/cart", () => ({
  addShopifyMerchandiseLinesToCart: mocks.addShopifyMerchandiseLinesToCart,
  addShopifyProductToCart: vi.fn(),
  getShopifyCartCount: vi.fn(),
  getShopifyCartLineQuantity: vi.fn(),
  getShopifyCartViewModel: vi.fn(),
  getShopifyCheckoutUrl: vi.fn(),
  removeShopifyCartItem: vi.fn(),
  updateShopifyCartItemQuantity: vi.fn(),
}));

import { addStorefrontMerchandiseLinesToCart } from "@/lib/commerce/storefront-cart";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addStorefrontMerchandiseLinesToCart", () => {
  it("adds only locally visible variants and reports skipped", async () => {
    mocks.findMany.mockResolvedValue([
      { shopifyVariantId: "gid://shopify/ProductVariant/1" },
    ]);
    mocks.addShopifyMerchandiseLinesToCart.mockResolvedValue({
      cart: {
        lines: {
          nodes: [
            {
              merchandise: { id: "gid://shopify/ProductVariant/1" },
              quantity: 2,
            },
          ],
        },
      },
      warnings: [],
    });

    const result = await addStorefrontMerchandiseLinesToCart([
      { variantId: "1", quantity: 2 },
      { variantId: "99", quantity: 1 },
    ]);

    expect(mocks.addShopifyMerchandiseLinesToCart).toHaveBeenCalledWith([
      { merchandiseId: "gid://shopify/ProductVariant/1", quantity: 2 },
    ]);
    expect(result).toEqual({
      added: 2,
      skipped: 1,
      adjusted: false,
      warnings: [],
    });
  });

  it("returns all skipped when nothing is visible", async () => {
    mocks.findMany.mockResolvedValue([]);

    const result = await addStorefrontMerchandiseLinesToCart([
      { variantId: "7", quantity: 1 },
    ]);

    expect(mocks.addShopifyMerchandiseLinesToCart).not.toHaveBeenCalled();
    expect(result).toEqual({
      added: 0,
      skipped: 1,
      adjusted: false,
      warnings: [],
    });
  });
});
