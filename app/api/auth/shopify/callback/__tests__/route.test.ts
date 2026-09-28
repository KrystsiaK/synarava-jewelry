import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
}));

vi.mock("@/lib/shopify/customer-account/config", () => ({
  CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS: 30 * 24 * 60 * 60,
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

import { decryptCustomerSecret } from "@/lib/shopify/customer-account/crypto";

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

  it("keeps the return path when Shopify denies the authorization", async () => {
    vi.mocked(decryptCustomerSecret).mockReturnValue(JSON.stringify({
      createdAt: Date.now(),
      nonce: "nonce",
      returnTo: "/pt/products/ring",
      state: "state-value",
      verifier: "v".repeat(43),
    }));
    const request = new NextRequest(
      "https://localhost:8080/api/auth/shopify/callback?error=access_denied&state=state-value",
      { headers: { cookie: "synarava-shopify-customer-oauth=encrypted" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://shop.synarava.com/pt/login?error=shopify&redirectTo=%2Fpt%2Fproducts%2Fring",
    );
  });
});
