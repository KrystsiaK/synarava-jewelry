import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  discover: vi.fn(),
}));

vi.mock("@/lib/shopify/customer-account/config", () => ({
  getShopifyCustomerAccountConfig: mocks.getConfig,
  safeCustomerReturnPath: (value: string | null) => value && value.startsWith("/") ? value : "/en/profile",
  SHOPIFY_CUSTOMER_OAUTH_COOKIE: "synarava-shopify-customer-oauth",
}));

vi.mock("@/lib/shopify/customer-account/crypto", () => ({
  encryptCustomerSecret: vi.fn(() => "encrypted-transaction"),
}));

vi.mock("@/lib/shopify/customer-account/discovery", () => ({
  getCustomerAuthorizationDiscovery: mocks.discover,
}));

import { GET } from "../route";

describe("Shopify customer account authorize", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConfig.mockReturnValue({
      appOrigin: "https://shop.synarava.com",
      callbackUrl: "https://shop.synarava.com/api/auth/shopify/callback",
      clientId: "customer-client-id",
      sessionSecret: "session-secret",
      shopDomain: "synarava.myshopify.com",
    });
    mocks.discover.mockResolvedValue({
      authorization_endpoint: "https://shopify.com/authentication/110141768029/oauth/authorize",
    });
  });

  it("redirects a document navigation to Shopify with PKCE and one transaction cookie", async () => {
    const request = new NextRequest(
      "https://shop.synarava.com/api/auth/shopify?returnTo=%2Fen%2Fprofile",
      { headers: { "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" } },
    );

    const response = await GET(request);
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(location.origin).toBe("https://shopify.com");
    expect(location.searchParams.get("client_id")).toBe("customer-client-id");
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://shop.synarava.com/api/auth/shopify/callback",
    );
    expect(location.searchParams.get("scope")).toBe("openid email customer-account-api:full");
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(location.searchParams.get("nonce")).toBeTruthy();
    expect(location.searchParams.get("code_challenge")).toBeTruthy();
    expect(location.search).not.toContain("client_secret");
    expect(response.headers.get("set-cookie")).toContain("synarava-shopify-customer-oauth=encrypted-transaction");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Path=/api/auth/shopify");
  });

  it("sends a localhost start to the public callback host before setting a cookie", async () => {
    const request = new NextRequest(
      "http://127.0.0.1:3000/api/auth/shopify?returnTo=%2Fen%2Fprofile",
      { headers: { "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://shop.synarava.com/api/auth/shopify?returnTo=%2Fen%2Fprofile",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.discover).not.toHaveBeenCalled();
  });

  it("uses the trusted public proxy host instead of redirecting from Railway's internal localhost", async () => {
    vi.stubEnv("APP_URL", "https://shop.synarava.com");
    const request = new NextRequest(
      "http://localhost:3000/api/auth/shopify?returnTo=%2Fen%2Fprofile",
      {
        headers: {
          host: "localhost:3000",
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "x-forwarded-host": "shop.synarava.com",
          "x-forwarded-proto": "https",
        },
      },
    );

    const response = await GET(request);
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.origin).toBe("https://shopify.com");
    expect(response.headers.get("set-cookie")).toContain(
      "synarava-shopify-customer-oauth=encrypted-transaction",
    );
    expect(mocks.discover).toHaveBeenCalledOnce();
  });

  it("does not mint a PKCE transaction for an RSC or prefetch fetch", async () => {
    const request = new NextRequest("https://shop.synarava.com/api/auth/shopify?returnTo=%2Fen%2Fprofile", {
      headers: { rsc: "1", "next-router-prefetch": "1" },
    });

    const response = await GET(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.discover).not.toHaveBeenCalled();
  });
});
