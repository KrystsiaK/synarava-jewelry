/**
 * Guard: observation error / source / warning survive across requests.
 * Failed reads must not clear a prior error just because an older snapshot
 * amount is still on disk (skipRefresh would otherwise go silent).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { siteSetting: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}));

import {
  parseAnnouncementBarSetting,
  refreshAnnouncementBarShopifySnapshot,
} from "@/lib/content/announcement-bar";
import { DEFAULT_ANNOUNCEMENT_BAR_SETTING } from "@/lib/content/announcement-bar-fields";

const shopMoney = { amount: "69.0", currencyCode: "EUR" };

describe("refreshAnnouncementBarShopifySnapshot persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsert.mockImplementation(async ({ update }: { update: { value: unknown } }) => ({
      value: update.value,
    }));
  });

  it("persists a fresh snapshot amount and clears the prior observation error", async () => {
    mocks.findUnique.mockResolvedValue({
      value: {
        ...DEFAULT_ANNOUNCEMENT_BAR_SETTING,
        shopifyObservationError: "Missing Shopify permission: read_shipping (cannot read delivery profiles).",
      },
    });

    const next = await refreshAnnouncementBarShopifySnapshot({
      snapshot: { freeShippingMinSubtotal: shopMoney },
      error: null,
      source: { profileName: "General", zoneName: "Portugal", rateName: "Free shipping" },
      warning: null,
    });

    expect(next.shopifySnapshot).toEqual({ freeShippingMinSubtotal: shopMoney });
    expect(next.shopifyObservationError).toBeNull();
    expect(next.shopifyObservationSource).toEqual({
      profileName: "General",
      zoneName: "Portugal",
      rateName: "Free shipping",
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("persists a new observation error even when keeping a prior snapshot amount", async () => {
    mocks.findUnique.mockResolvedValue({
      value: {
        ...DEFAULT_ANNOUNCEMENT_BAR_SETTING,
        shopifySnapshot: { freeShippingMinSubtotal: shopMoney },
        shopifyObservationSource: {
          profileName: "General",
          zoneName: "Portugal",
          rateName: "Free shipping",
        },
        shopifyObservationError: null,
      },
    });

    const next = await refreshAnnouncementBarShopifySnapshot({
      snapshot: undefined,
      error: "Missing Shopify permission: read_shipping (cannot read delivery profiles).",
    });

    expect(next.shopifySnapshot).toEqual({ freeShippingMinSubtotal: shopMoney });
    expect(next.shopifyObservationError).toBe(
      "Missing Shopify permission: read_shipping (cannot read delivery profiles).",
    );
    // Prior source stays so admin can see which rate was last observed.
    expect(next.shopifyObservationSource?.zoneName).toBe("Portugal");
  });

  it("persists not-found error with a null-amount snapshot across parse round-trip", async () => {
    mocks.findUnique.mockResolvedValue({ value: { ...DEFAULT_ANNOUNCEMENT_BAR_SETTING } });

    const next = await refreshAnnouncementBarShopifySnapshot({
      snapshot: { freeShippingMinSubtotal: null },
      error: "No free shipping rate found for Portugal (PT) in Shopify.",
      source: null,
      warning: null,
    });

    const parsed = parseAnnouncementBarSetting(next);
    expect(parsed.shopifySnapshot).toEqual({ freeShippingMinSubtotal: null });
    expect(parsed.shopifyObservationError).toMatch(/No free shipping rate/);
    expect(parsed.shopifyObservationSource).toBeNull();
  });
});
