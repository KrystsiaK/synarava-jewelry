import { afterEach, describe, expect, it } from "vitest";

import { getTrustedRequestOrigin } from "@/lib/security/request-origin";

const originalAppUrl = process.env.APP_URL;
const originalPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
  if (originalPublicSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalPublicSiteUrl;
});

function request(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("getTrustedRequestOrigin", () => {
  it("uses the Host header for local e2e loopback", () => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(
      getTrustedRequestOrigin(
        request("http://localhost:3000/en/cart/1:1", { host: "127.0.0.1:3000" }),
      ),
    ).toBe("http://127.0.0.1:3000");
  });

  it("ignores unlisted x-forwarded-host values", () => {
    process.env.APP_URL = "https://shop.synarava.com";
    expect(
      getTrustedRequestOrigin(
        request("https://shop.synarava.com/en/cart/1:1", {
          host: "shop.synarava.com",
          "x-forwarded-host": "evil.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://shop.synarava.com");
  });

  it("falls back to APP_URL when Host is not allowlisted", () => {
    process.env.APP_URL = "https://shop.synarava.com";
    expect(
      getTrustedRequestOrigin(
        request("https://unknown.example/en/cart/1:1", {
          host: "unknown.example",
          "x-forwarded-host": "evil.example",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://shop.synarava.com");
  });

  it("rejects non-http(s) forwarded proto and uses a safe default", () => {
    process.env.APP_URL = "https://shop.synarava.com";
    expect(
      getTrustedRequestOrigin(
        request("https://shop.synarava.com/en/cart/1:1", {
          host: "shop.synarava.com",
          "x-forwarded-proto": "ftp",
        }),
      ),
    ).toBe("https://shop.synarava.com");
  });
});
