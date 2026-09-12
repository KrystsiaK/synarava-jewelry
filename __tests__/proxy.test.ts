import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

describe("storefront Content Security Policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows the Shopify privacy banner font CDN and consent endpoint", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SHOPIFY_CHECKOUT_ROOT_DOMAIN",
      "checkout.synarava.test",
    );

    const response = await proxy(
      new NextRequest("https://shop.synarava.test/en/login"),
    );
    const csp = response.headers.get("Content-Security-Policy");
    const connectDirective = csp
      ?.split("; ")
      .find((directive) => directive.startsWith("connect-src "));

    expect(csp).toContain(
      "font-src 'self' data: https://cdn.shopify.com https://*.shopifycdn.com",
    );
    expect(connectDirective).toContain("https://checkout.synarava.test");
  });

  it("allows consent-gated analytics and advertising destinations", async () => {
    const response = await proxy(new NextRequest("https://shop.synarava.test/en/"));
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    const imageDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("img-src "));

    expect(csp).toContain("https://www.googletagmanager.com");
    expect(csp).toContain("https://connect.facebook.net");
    expect(csp).toContain("https://www.google-analytics.com");
    expect(csp).toContain("https://www.facebook.com");
    expect(imageDirective).toContain("https://www.googletagmanager.com");
  });
});

describe("admin session proxy", () => {
  it("turns an unauthenticated admin action into a client-side login redirect", async () => {
    const response = await proxy(new NextRequest("https://synarava.test/admin/products/product-1", {
      method: "POST",
      headers: { "next-action": "stale-action-id" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-action-redirect")).toBe(
      "/admin/login?redirectTo=%2Fadmin%2Fproducts%2Fproduct-1;replace",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps a temporary redirect for an unauthenticated page request", async () => {
    const response = await proxy(new NextRequest("https://synarava.test/admin/products"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://synarava.test/admin/login?redirectTo=%2Fadmin%2Fproducts",
    );
  });
});
