import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
  getShopifyCustomerAccountConfig: () => ({ appOrigin: "https://synarava.com" }),
}));

import { isTerminalCustomerTokenError, requestCustomerTokens, ShopifyCustomerTokenError } from "../tokens";

describe("isTerminalCustomerTokenError", () => {
  it("treats a 4xx rejection of the refresh grant as terminal", () => {
    expect(isTerminalCustomerTokenError(new ShopifyCustomerTokenError("invalid_grant", 400))).toBe(true);
  });

  it("treats a network failure (no status) as transient", () => {
    expect(isTerminalCustomerTokenError(new ShopifyCustomerTokenError("Unable to reach Shopify", null))).toBe(false);
  });

  it("treats a 5xx Shopify outage as transient", () => {
    expect(isTerminalCustomerTokenError(new ShopifyCustomerTokenError("Shopify token request failed (503).", 503))).toBe(false);
  });

  it("treats a non-token error as transient", () => {
    expect(isTerminalCustomerTokenError(new Error("boom"))).toBe(false);
  });
});

describe("requestCustomerTokens", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("wraps a network-level fetch failure with a null status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(requestCustomerTokens("https://accounts.example/token", new URLSearchParams()))
      .rejects.toMatchObject({ status: null });

    vi.unstubAllGlobals();
  });

  it("carries the HTTP status when Shopify rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 400 })));

    await expect(requestCustomerTokens("https://accounts.example/token", new URLSearchParams()))
      .rejects.toMatchObject({ status: 400 });

    vi.unstubAllGlobals();
  });
});
