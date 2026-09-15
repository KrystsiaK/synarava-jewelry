import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
}));

vi.mock("@/lib/shopify/customer-account/config", () => ({
  getShopifyCustomerAccountConfig: mocks.getConfig,
  SHOPIFY_CUSTOMER_OAUTH_COOKIE: "synarava-shopify-customer-oauth",
  SHOPIFY_CUSTOMER_SESSION_COOKIE: "synarava-shopify-customer-session",
}));

vi.mock("@/lib/shopify/customer-account/crypto", () => ({
  decryptCustomerSecret: vi.fn(),
  encryptCustomerSecret: vi.fn(),
}));

vi.mock("@/lib/shopify/customer-account/discovery", () => ({
  getCustomerAuthorizationDiscovery: vi.fn(),
}));

vi.mock("@/lib/shopify/customer-account/id-token", () => ({
  verifyShopifyIdToken: vi.fn(),
}));

vi.mock("@/lib/shopify/customer-account/tokens", () => ({
  requestCustomerTokens: vi.fn(),
}));

vi.mock("@/lib/shopify/customer-account/session-store", () => ({
  createStoredCustomerSession: vi.fn(),
}));

import { GET } from "../route";

describe("Shopify customer account callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getConfig.mockReturnValue({
      appOrigin: "https://shop.synarava.com",
      callbackUrl: "https://shop.synarava.com/api/auth/shopify/callback",
      clientId: "customer-client-id",
      sessionSecret: "session-secret",
      shopDomain: "synarava.myshopify.com",
    });
  });

  it("redirects callback errors to the configured public origin behind a proxy", async () => {
    const request = new NextRequest(
      "https://localhost:8080/api/auth/shopify/callback",
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://shop.synarava.com/login?error=shopify",
    );
  });
});
