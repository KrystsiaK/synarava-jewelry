import { describe, expect, it } from "vitest";

/**
 * Mirrors the client helpers in
 * `shopify/themes/synarava-redirect/layout/theme.liquid`.
 * If these fail after a theme edit, update both places.
 */

function isCartPath(pathname: string) {
  return /\/cart\/?$/.test(pathname);
}

function localePrefix(localeRoot: string) {
  if (!localeRoot || localeRoot === "/") return "";
  return localeRoot.replace(/\/$/, "");
}

function applyCollectionsAllRedirect(pathname: string) {
  const match = pathname
    .replace(/\/$/, "")
    .match(/^(\/[a-z]{2}(?:-[A-Za-z]{2})?)?\/collections\/all$/i);
  if (!match) return null;
  return `${match[1] || ""}/shop`;
}

function buyAgainTarget(params: {
  hostname: string;
  localeRoot: string;
  permalink: string;
  country?: string;
}) {
  const prefix = localePrefix(params.localeRoot);
  const url = new URL(`https://${params.hostname}${prefix}/cart/${params.permalink}`);
  if (params.country) url.searchParams.set("country", params.country);
  return url.toString();
}

function shouldSkipRedirect(pathname: string) {
  if (
    pathname === "/checkpoint" ||
    pathname === "/throttle/queue" ||
    pathname === "/challenge"
  ) {
    return true;
  }
  return /^\/(checkouts?|orders|account|payments?|wallets|services)\b/i.test(pathname);
}

describe("synarava redirect theme rules", () => {
  it("detects localized and bare cart paths", () => {
    expect(isCartPath("/pt/cart")).toBe(true);
    expect(isCartPath("/pt/cart/")).toBe(true);
    expect(isCartPath("/cart")).toBe(true);
    expect(isCartPath("/pt/cart/66048797442397:1")).toBe(false);
  });

  it("builds Buy again headless permalink URL and drops cart_link_id", () => {
    expect(
      buyAgainTarget({
        hostname: "shop.synarava.com",
        localeRoot: "/pt",
        permalink: "66048797442397:1",
        country: "PT",
      }),
    ).toBe("https://shop.synarava.com/pt/cart/66048797442397:1?country=PT");
  });

  it("maps collections/all to shop for each locale prefix", () => {
    expect(applyCollectionsAllRedirect("/pt/collections/all")).toBe("/pt/shop");
    expect(applyCollectionsAllRedirect("/en/collections/all")).toBe("/en/shop");
    expect(applyCollectionsAllRedirect("/collections/all")).toBe("/shop");
    expect(applyCollectionsAllRedirect("/pt/collections/rings")).toBeNull();
  });

  it("skips Shopify system surfaces", () => {
    expect(shouldSkipRedirect("/challenge")).toBe(true);
    expect(shouldSkipRedirect("/checkpoint")).toBe(true);
    expect(shouldSkipRedirect("/throttle/queue")).toBe(true);
    expect(shouldSkipRedirect("/checkouts/cn/abc")).toBe(true);
    expect(shouldSkipRedirect("/pt/products/ring")).toBe(false);
  });
});
