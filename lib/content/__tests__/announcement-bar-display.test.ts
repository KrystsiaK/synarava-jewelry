import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF,
  ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S,
  announcementMarqueeCopies,
  announcementMarqueeDurationSec,
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

describe("announcementMarqueeCopies", () => {
  it("returns enough copies for a seamless dual-half track", () => {
    const copies = announcementMarqueeCopies("Free shipping");
    expect(copies).toHaveLength(ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF);
    expect(copies.every((copy) => copy === "Free shipping")).toBe(true);
  });
});

describe("announcementMarqueeDurationSec", () => {
  it("derives duration from half-cycle travel at the target speed", () => {
    expect(announcementMarqueeDurationSec(4300)).toBeCloseTo(
      4300 / 2 / ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S,
      5,
    );
    expect(announcementMarqueeDurationSec(900, 45)).toBe(10);
  });

  it("returns 0 for non-positive inputs", () => {
    expect(announcementMarqueeDurationSec(0)).toBe(0);
    expect(announcementMarqueeDurationSec(-10)).toBe(0);
    expect(announcementMarqueeDurationSec(100, 0)).toBe(0);
  });
});
