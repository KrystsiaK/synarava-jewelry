import { describe, expect, it } from "vitest";

import { withCheckoutSsoSilent } from "@/lib/shopify/checkout-url";

describe("withCheckoutSsoSilent", () => {
  it("appends sso=silent when the checkout URL has no query string", () => {
    expect(withCheckoutSsoSilent("https://shop.example/checkouts/abc")).toBe(
      "https://shop.example/checkouts/abc?sso=silent",
    );
  });

  it("appends sso=silent alongside existing query params", () => {
    expect(withCheckoutSsoSilent("https://shop.example/checkouts/abc?key=1")).toBe(
      "https://shop.example/checkouts/abc?key=1&sso=silent",
    );
  });

  it("does not duplicate sso=silent when already present", () => {
    expect(withCheckoutSsoSilent("https://shop.example/checkouts/abc?sso=silent")).toBe(
      "https://shop.example/checkouts/abc?sso=silent",
    );
  });

  it("replaces a non-silent sso value with silent", () => {
    expect(withCheckoutSsoSilent("https://shop.example/checkouts/abc?sso=other")).toBe(
      "https://shop.example/checkouts/abc?sso=silent",
    );
  });
});
