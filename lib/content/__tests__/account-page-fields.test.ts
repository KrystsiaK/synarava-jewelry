import en from "@/messages/en.json";
import { describe, expect, it } from "vitest";

import { ACCOUNT_PAGE_KEYS, accountPageAreaForHash } from "@/lib/content/account-page-fields";
import { COMMERCE_COPY_KEYS } from "@/lib/content/commerce-copy-fields";
import { STOREFRONT_COPY_KEYS } from "@/lib/content/storefront-copy-fields";
import { flattenMessages } from "@/lib/i18n/utils";

describe("account page fields", () => {
  it("stays out of the cart and shared registries", () => {
    const commerce = new Set(COMMERCE_COPY_KEYS);
    const shared = new Set(STOREFRONT_COPY_KEYS);
    expect(ACCOUNT_PAGE_KEYS.filter((key) => commerce.has(key) || shared.has(key))).toEqual([]);
    expect(ACCOUNT_PAGE_KEYS).toContain("profile.tabs.overview");
    expect(ACCOUNT_PAGE_KEYS).toContain("profile.security.body");
  });

  it("matches shipped English copy except optional plural categories", () => {
    const english = flattenMessages(en as Record<string, unknown>);
    const optional = ACCOUNT_PAGE_KEYS.filter((key) => key.endsWith(".few") || key.endsWith(".many"));
    for (const key of ACCOUNT_PAGE_KEYS) {
      if (optional.includes(key)) continue;
      expect(english[key], key).toEqual(expect.any(String));
    }
  });

  it("reads the account-page hash", () => {
    expect(accountPageAreaForHash("#account-reviews")).toBe("reviews");
    expect(accountPageAreaForHash("#account-orders")).toBe("orders");
    expect(accountPageAreaForHash("wishlist")).toBe("wishlist");
    expect(accountPageAreaForHash("#commerce-cart")).toBeNull();
  });
});
