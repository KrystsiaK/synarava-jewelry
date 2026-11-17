import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF,
  announcementMarqueeCopies,
  resolveAnnouncementBarText,
} from "@/lib/content/announcement-bar-display";
import { formatShopifyMoneyByLocale } from "@/lib/shopify/money";

describe("formatShopifyMoneyByLocale", () => {
  it("formats EUR by locale without hardcoding the threshold", () => {
    expect(formatShopifyMoneyByLocale("45.0", "EUR", "en")).toBe("€45.00");
    expect(formatShopifyMoneyByLocale("45.0", "EUR", "pt")).toMatch(/45,00\s*€/);
    expect(formatShopifyMoneyByLocale("45.0", "EUR", "ru")).toMatch(/45/);
  });
});

describe("resolveAnnouncementBarText", () => {
  const freeShippingMinSubtotal = { amount: "45.0", currencyCode: "EUR" };

  it("hides when off", () => {
    expect(resolveAnnouncementBarText({
      enabled: false,
      freeShippingMinSubtotal,
      template: "Free shipping from {amount}",
      locale: "en",
    })).toBeNull();
  });

  it("hides when Shopify snapshot amount is missing (enabled)", () => {
    expect(resolveAnnouncementBarText({
      enabled: true,
      freeShippingMinSubtotal: null,
      template: "Free shipping from {amount}",
      locale: "en",
    })).toBeNull();
  });

  it("substitutes the formatted amount into the template", () => {
    expect(resolveAnnouncementBarText({
      enabled: true,
      freeShippingMinSubtotal,
      template: "Free shipping in Portugal from {amount}",
      locale: "en",
    })).toBe("Free shipping in Portugal from €45.00");
  });
});

describe("announcementMarqueeCopies", () => {
  it("returns enough copies for a seamless dual-half track", () => {
    const copies = announcementMarqueeCopies("Free shipping");
    expect(copies).toHaveLength(ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF);
    expect(copies.every((copy) => copy === "Free shipping")).toBe(true);
  });
});
