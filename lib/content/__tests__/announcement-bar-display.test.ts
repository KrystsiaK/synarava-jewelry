import { describe, expect, it } from "vitest";

import { resolveAnnouncementBarText } from "@/lib/content/announcement-bar-display";
import { formatShopifyMoneyByLocale } from "@/lib/shopify/money";

describe("formatShopifyMoneyByLocale", () => {
  it("formats EUR by locale without hardcoding the threshold", () => {
    expect(formatShopifyMoneyByLocale("45.0", "EUR", "en")).toBe("€45.00");
    expect(formatShopifyMoneyByLocale("45.0", "EUR", "pt")).toMatch(/45,00\s*€/);
    expect(formatShopifyMoneyByLocale("45.0", "EUR", "ru")).toMatch(/45/);
  });
});

describe("resolveAnnouncementBarText", () => {
  const threshold = { amount: "45.0", currencyCode: "EUR" };

  it("hides when off", () => {
    expect(resolveAnnouncementBarText({
      enabled: false,
      threshold,
      template: "Free shipping from {amount}",
      locale: "en",
    })).toBeNull();
  });

  it("hides when threshold is missing", () => {
    expect(resolveAnnouncementBarText({
      enabled: true,
      threshold: null,
      template: "Free shipping from {amount}",
      locale: "en",
    })).toBeNull();
  });

  it("substitutes the formatted amount into the template", () => {
    expect(resolveAnnouncementBarText({
      enabled: true,
      threshold,
      template: "Free shipping in Portugal from {amount}",
      locale: "en",
    })).toBe("Free shipping in Portugal from €45.00");
  });
});
