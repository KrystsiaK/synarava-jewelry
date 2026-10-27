const mocks = vi.hoisted(() => ({
  addShopifyProductToCart: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("@/lib/shopify/cart", () => ({
  addShopifyProductToCart: mocks.addShopifyProductToCart,
  addShopifyMerchandiseLinesToCart: vi.fn(),
  getShopifyCartCount: vi.fn(),
  getShopifyCartLineQuantity: vi.fn(),
  getShopifyCartViewModel: vi.fn(),
  getShopifyCheckoutUrl: vi.fn(),
  removeShopifyCartItem: vi.fn(),
  updateShopifyCartItemQuantity: vi.fn(),
}));

import { addStorefrontProductToCart } from "@/lib/commerce/storefront-cart";

function inStockProduct(overrides: {
  shopifyHandle?: string | null;
  shopifySnapshot?: unknown;
  variants?: Array<{
    shopifyVariantId: string | null;
    status?: string;
    stockOnHand?: number;
    inventoryPolicy?: string;
    tracked?: boolean;
  }>;
} = {}) {
  return {
    shopifyHandle: overrides.shopifyHandle ?? "shopify-handle",
    shopifySnapshot: overrides.shopifySnapshot ?? {
      variants: [{ id: "gid://shopify/ProductVariant/123", inventoryQuantity: 5 }],
    },
    variants: overrides.variants ?? [
      {
        shopifyVariantId: "gid://shopify/ProductVariant/123",
        status: "ACTIVE",
        stockOnHand: 3,
        inventoryPolicy: "DENY",
        tracked: true,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addStorefrontProductToCart", () => {
  it("uses the Shopify identity saved during product sync when no merchandiseId is given", async () => {
    mocks.findFirst.mockResolvedValue(inStockProduct());

    await addStorefrontProductToCart("local-slug", 1);

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ slug: "local-slug" }),
    }));
    expect(mocks.addShopifyProductToCart).toHaveBeenCalledWith(
      "shopify-handle",
      1,
      "gid://shopify/ProductVariant/123",
    );
  });

  it("refuses to add a product that isn't locally visible, even without a merchandiseId (REV-08)", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(addStorefrontProductToCart("hidden-slug", 2)).rejects.toThrow("Product not available.");

    expect(mocks.addShopifyProductToCart).not.toHaveBeenCalled();
  });

  it("refuses an explicit merchandiseId that isn't visible locally", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      addStorefrontProductToCart("hidden-slug", 1, "gid://shopify/ProductVariant/selected"),
    ).rejects.toThrow("Product not available.");

    expect(mocks.addShopifyProductToCart).not.toHaveBeenCalled();
  });

  it("keeps an explicitly selected merchandise id and checks it against the same visibility policy", async () => {
    mocks.findFirst.mockResolvedValue(
      inStockProduct({
        shopifyHandle: "local-slug",
        shopifySnapshot: {
          variants: [{ id: "gid://shopify/ProductVariant/selected", inventoryQuantity: 2 }],
        },
        variants: [
          {
            shopifyVariantId: "gid://shopify/ProductVariant/selected",
            status: "ACTIVE",
            stockOnHand: 1,
            inventoryPolicy: "DENY",
            tracked: true,
          },
        ],
      }),
    );

    await addStorefrontProductToCart(
      "local-slug",
      1,
      "gid://shopify/ProductVariant/selected",
    );

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: "local-slug",
        variants: {
          some: {
            shopifyVariantId: "gid://shopify/ProductVariant/selected",
            status: { in: ["ACTIVE", "UNLISTED"] },
          },
        },
      }),
    }));
    expect(mocks.addShopifyProductToCart).toHaveBeenCalledWith(
      "local-slug",
      1,
      "gid://shopify/ProductVariant/selected",
    );
  });

  it("refuses add-to-cart when our stock is zero (DENY)", async () => {
    mocks.findFirst.mockResolvedValue(
      inStockProduct({
        variants: [
          {
            shopifyVariantId: "gid://shopify/ProductVariant/123",
            status: "ACTIVE",
            stockOnHand: 0,
            inventoryPolicy: "DENY",
            tracked: true,
          },
        ],
      }),
    );

    await expect(addStorefrontProductToCart("local-slug", 1)).rejects.toThrow(
      "Product is out of stock.",
    );
    expect(mocks.addShopifyProductToCart).not.toHaveBeenCalled();
  });

  it("refuses add-to-cart when Shopify snapshot inventory is zero (DENY)", async () => {
    mocks.findFirst.mockResolvedValue(
      inStockProduct({
        shopifySnapshot: {
          variants: [{ id: "gid://shopify/ProductVariant/123", inventoryQuantity: 0 }],
        },
      }),
    );

    await expect(addStorefrontProductToCart("local-slug", 1)).rejects.toThrow(
      "Product is out of stock.",
    );
    expect(mocks.addShopifyProductToCart).not.toHaveBeenCalled();
  });

  it("allows add-to-cart when Shopify copy is missing but ours is in stock", async () => {
    mocks.findFirst.mockResolvedValue(
      inStockProduct({
        shopifySnapshot: null,
      }),
    );

    await addStorefrontProductToCart("local-slug", 1);

    expect(mocks.addShopifyProductToCart).toHaveBeenCalled();
  });
});
