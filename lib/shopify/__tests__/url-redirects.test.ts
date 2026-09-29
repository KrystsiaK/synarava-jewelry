import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasShopifyAdminConfig: vi.fn(),
  shopifyAdminRequest: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { SHOPIFY_STORE_DOMAIN: "synarava.myshopify.com" },
}));

vi.mock("@/lib/shopify/admin", () => ({
  hasShopifyAdminConfig: mocks.hasShopifyAdminConfig,
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {
    constructor(
      message: string,
      readonly details?: Array<{ message: string }>,
    ) {
      super(message);
      this.name = "ShopifyAdminError";
    }
  },
}));

import { ShopifyAdminError } from "@/lib/shopify/admin";
import { fetchShopifyUrlRedirects } from "@/lib/shopify/url-redirects";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchShopifyUrlRedirects", () => {
  it("returns unconfigured when Admin API credentials are missing", async () => {
    mocks.hasShopifyAdminConfig.mockReturnValue(false);
    await expect(fetchShopifyUrlRedirects()).resolves.toEqual({ status: "unconfigured" });
    expect(mocks.shopifyAdminRequest).not.toHaveBeenCalled();
  });

  it("lists redirects and builds the Shopify Admin deep-link", async () => {
    mocks.hasShopifyAdminConfig.mockReturnValue(true);
    mocks.shopifyAdminRequest.mockResolvedValue({
      urlRedirectsCount: { count: 2, precision: "EXACT" },
      urlRedirects: {
        nodes: [
          { id: "gid://shopify/UrlRedirect/1", path: "/old", target: "/products/new" },
          { id: "gid://shopify/UrlRedirect/2", path: "/about", target: "/pages/about" },
        ],
      },
    });

    await expect(fetchShopifyUrlRedirects()).resolves.toMatchObject({
      status: "ok",
      shopDomain: "synarava.myshopify.com",
      adminRedirectsUrl: "https://admin.shopify.com/store/synarava/content/redirects",
      count: 2,
      truncated: false,
      redirects: [
        { path: "/old", target: "/products/new" },
        { path: "/about", target: "/pages/about" },
      ],
    });
    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[0]).toContain("urlRedirects");
    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[0]).toContain("urlRedirectsCount");
  });

  it("marks truncated when the Shopify count exceeds the sample page", async () => {
    mocks.hasShopifyAdminConfig.mockReturnValue(true);
    mocks.shopifyAdminRequest.mockResolvedValue({
      urlRedirectsCount: { count: 100, precision: "EXACT" },
      urlRedirects: {
        nodes: [{ id: "gid://shopify/UrlRedirect/1", path: "/a", target: "/b" }],
      },
    });

    await expect(fetchShopifyUrlRedirects(1)).resolves.toMatchObject({
      status: "ok",
      truncated: true,
      count: 100,
    });
  });

  it("surfaces missing read_online_store_navigation as missing_scope", async () => {
    mocks.hasShopifyAdminConfig.mockReturnValue(true);
    mocks.shopifyAdminRequest.mockRejectedValue(
      new ShopifyAdminError("Access denied for urlRedirects field.", [
        { message: "Access denied for urlRedirects field." },
      ]),
    );

    await expect(fetchShopifyUrlRedirects()).resolves.toMatchObject({
      status: "missing_scope",
      requiredScope: "read_online_store_navigation",
      adminRedirectsUrl: "https://admin.shopify.com/store/synarava/content/redirects",
    });
  });

  it("returns a soft error for other Admin failures", async () => {
    mocks.hasShopifyAdminConfig.mockReturnValue(true);
    mocks.shopifyAdminRequest.mockRejectedValue(new ShopifyAdminError("Shopify Admin API returned 500."));

    await expect(fetchShopifyUrlRedirects()).resolves.toMatchObject({
      status: "error",
      message: "Shopify Admin API returned 500.",
    });
  });
});
