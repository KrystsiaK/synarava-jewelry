import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { storefrontLocale: { findMany: mocks.findMany } },
}));

import { invalidateStorefrontLocaleCache } from "@/lib/i18n/storefront-locale-cache";
import { proxy } from "@/proxy";

const REGISTRY_ROWS = [
  { routeSegment: "en", isDefault: true, isPublished: true },
  { routeSegment: "pt", isDefault: false, isPublished: true },
  { routeSegment: "ru", isDefault: false, isPublished: false },
];

beforeEach(() => {
  mocks.findMany.mockReset();
  mocks.findMany.mockResolvedValue(REGISTRY_ROWS);
  invalidateStorefrontLocaleCache();
});

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

  it("allows blob: media for local video previews", async () => {
    const response = await proxy(new NextRequest("https://shop.synarava.test/en/"));
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    const mediaDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("media-src "));

    expect(mediaDirective).toBeDefined();
    expect(mediaDirective).toContain("blob:");
    expect(mediaDirective).toContain("'self'");
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
    expect(response.cookies.get("synarava-admin-return-to")?.value).toBe("/admin/products");
  });

  it("remembers the intended admin path on an expired-action bounce", async () => {
    const response = await proxy(new NextRequest("https://synarava.test/admin/products/product-1", {
      method: "POST",
      headers: { "next-action": "stale-action-id" },
    }));

    expect(response.cookies.get("synarava-admin-return-to")?.value).toBe(
      "/admin/products/product-1",
    );
  });
});

describe("registry-driven locale routing", () => {
  it("passes through a published locale prefix and sets x-locale", async () => {
    const response = await proxy(new NextRequest("https://synarava.test/pt/shop"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("permanently redirects a bare path to the default locale with no cookie", async () => {
    const response = await proxy(new NextRequest("https://synarava.test/shop"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://synarava.test/en/shop");
  });

  it("temporarily redirects a bare path to a valid, published cookie locale", async () => {
    const response = await proxy(new NextRequest("https://synarava.test/shop", {
      headers: { cookie: "synarava-locale=pt" },
    }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://synarava.test/pt/shop");
  });

  it("ignores a cookie for a registered but unpublished locale and falls back to default", async () => {
    const response = await proxy(new NextRequest("https://synarava.test/shop", {
      headers: { cookie: "synarava-locale=ru" },
    }));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://synarava.test/en/shop");
  });

  it("ignores a cookie for a locale that was never registered", async () => {
    const response = await proxy(new NextRequest("https://synarava.test/shop", {
      headers: { cookie: "synarava-locale=de" },
    }));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://synarava.test/en/shop");
  });

  it("passes a registered-but-unpublished locale segment through (layout 404s it, not a redirect loop)", async () => {
    const response = await proxy(new NextRequest("https://synarava.test/ru/shop"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("falls back to the emergency default segment when the registry is completely unreachable", async () => {
    mocks.findMany.mockRejectedValue(new Error("connection refused"));

    const response = await proxy(new NextRequest("https://synarava.test/shop"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://synarava.test/en/shop");
  });

  it("does not redirect-loop /en when the registry is unreachable", async () => {
    mocks.findMany.mockRejectedValue(new Error("connection refused"));

    const response = await proxy(new NextRequest("https://synarava.test/en"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBeLessThan(300);
  });

  it("does not redirect-loop /en when the registry table is empty", async () => {
    mocks.findMany.mockResolvedValue([]);

    const response = await proxy(new NextRequest("https://synarava.test/en"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBeLessThan(300);
  });
});
