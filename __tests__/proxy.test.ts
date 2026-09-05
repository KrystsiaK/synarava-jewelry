import { NextRequest } from "next/server";

import { proxy } from "../proxy";

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
      new NextRequest("https://shop.synarava.test/login"),
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
    const response = await proxy(new NextRequest("https://shop.synarava.test/"));
    const csp = response.headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("https://www.googletagmanager.com");
    expect(csp).toContain("https://connect.facebook.net");
    expect(csp).toContain("https://www.google-analytics.com");
    expect(csp).toContain("https://www.facebook.com");
  });
});
