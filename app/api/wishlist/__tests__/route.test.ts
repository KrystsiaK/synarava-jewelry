import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getTrustedClientIp: vi.fn(),
  getShopifyCustomerId: vi.fn(),
  findProduct: vi.fn(),
  getShopifyCustomerWishlistIds: vi.fn(),
  toggleShopifyCustomerWishlist: vi.fn(),
  revalidateStorefrontPath: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/security/request-ip", () => ({ getTrustedClientIp: mocks.getTrustedClientIp }));
vi.mock("@/lib/shopify/customer-account/api", () => ({ getShopifyCustomerId: mocks.getShopifyCustomerId }));
vi.mock("@/lib/db", () => ({ db: { product: { findUnique: mocks.findProduct } } }));
vi.mock("@/lib/shopify/wishlist", () => ({
  getShopifyCustomerWishlistIds: mocks.getShopifyCustomerWishlistIds,
  toggleShopifyCustomerWishlist: mocks.toggleShopifyCustomerWishlist,
}));
vi.mock("@/lib/content/revalidate-storefront", () => ({ revalidateStorefrontPath: mocks.revalidateStorefrontPath }));

import { GET, POST } from "../route";

function getRequest(productSlug = "lava-ring") {
  return new Request(`https://synarava.com/api/wishlist?productSlug=${productSlug}`);
}

function postRequest(body: unknown) {
  return new Request("https://synarava.com/api/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("wishlist API route (REV-16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    mocks.getShopifyCustomerId.mockResolvedValue("gid://shopify/Customer/1");
    mocks.findProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/10" });
    mocks.getShopifyCustomerWishlistIds.mockResolvedValue([]);
    mocks.toggleShopifyCustomerWishlist.mockResolvedValue({ isSaved: true });
  });

  it("rate-limits GET before checking identity", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 30 });

    const response = await GET(getRequest());

    expect(response.status).toBe(429);
    expect(mocks.getShopifyCustomerId).not.toHaveBeenCalled();
  });

  it("checks only identity, not the full profile query, for a heart toggle read", async () => {
    await GET(getRequest());

    expect(mocks.getShopifyCustomerId).toHaveBeenCalledTimes(1);
    expect(mocks.getShopifyCustomerWishlistIds).toHaveBeenCalledWith("gid://shopify/Customer/1");
  });

  it("rate-limits POST before checking identity", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 30 });

    const response = await POST(postRequest({ productSlug: "lava-ring" }));

    expect(response.status).toBe(429);
    expect(mocks.getShopifyCustomerId).not.toHaveBeenCalled();
  });

  it("requires sign-in for POST once past the rate limit", async () => {
    mocks.getShopifyCustomerId.mockResolvedValue(null);

    const response = await POST(postRequest({ productSlug: "lava-ring" }));

    expect(response.status).toBe(401);
    expect(mocks.toggleShopifyCustomerWishlist).not.toHaveBeenCalled();
  });
});
