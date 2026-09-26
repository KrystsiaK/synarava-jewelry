import { describe, expect, it } from "vitest";

import {
  COMMERCE_COPY_KEYS,
  overlayLegacyHeaderLabels,
} from "@/lib/content/commerce-copy-fields";
import {
  pickStorefrontCopyFields,
  STOREFRONT_COPY_KEYS,
} from "@/lib/content/storefront-copy-fields";

describe("commerce copy fields", () => {
  it("does not overlap the Shopify-synced storefront copy keys", () => {
    const synced = new Set(STOREFRONT_COPY_KEYS);
    expect(COMMERCE_COPY_KEYS.filter((key) => synced.has(key))).toEqual([]);
    expect(COMMERCE_COPY_KEYS).toContain("nav.cart");
    expect(COMMERCE_COPY_KEYS).toContain("loginPage.submit");
    expect(STOREFRONT_COPY_KEYS).not.toContain("nav.cart");
  });

  it("shows a legacy header label until the new setting has its own value", () => {
    expect(
      overlayLegacyHeaderLabels(
        { en: { "cart.eyebrow": "Bag" } },
        { en: { "nav.cart": "Cart" }, pt: { "nav.login": "Entrar" } },
      ),
    ).toEqual({
      en: { "nav.cart": "Cart", "cart.eyebrow": "Bag" },
      pt: { "nav.login": "Entrar" },
    });
  });

  it("prefers the commerce override over the legacy shared value", () => {
    expect(
      overlayLegacyHeaderLabels(
        { en: { "nav.cart": "Bag" } },
        { en: { "nav.cart": "Cart" } },
      ),
    ).toEqual({ en: { "nav.cart": "Bag" } });
  });
});

describe("pickStorefrontCopyFields", () => {
  it("drops keys that are no longer on the shared registry", () => {
    expect(
      pickStorefrontCopyFields(
        { "footer.tagline": "Stay", "nav.cart": "Cart", "loginPage.title": "Login" },
        ["footer.tagline"],
      ),
    ).toEqual({ "footer.tagline": "Stay" });
  });
});
