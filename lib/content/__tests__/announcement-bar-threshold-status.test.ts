import { describe, expect, it } from "vitest";

import {
  announcementThresholdHonestyStatus,
  shopifyThresholdFromSetting,
} from "@/lib/content/announcement-bar-threshold-status";
import { DEFAULT_ANNOUNCEMENT_BAR_SETTING } from "@/lib/content/announcement-bar-fields";

const shopMoney = { amount: "69.0", currencyCode: "EUR" };
const localMoney = { amount: "40.0", currencyCode: "EUR" };

describe("announcementThresholdHonestyStatus", () => {
  it("reads the Shopify amount from the snapshot, not local threshold", () => {
    const setting = {
      ...DEFAULT_ANNOUNCEMENT_BAR_SETTING,
      threshold: localMoney,
      shopifySnapshot: { freeShippingMinSubtotal: shopMoney },
    };
    expect(shopifyThresholdFromSetting(setting)).toEqual(shopMoney);
  });

  it("reports matches when local equals the snapshot and there is no conflict leaf", () => {
    const status = announcementThresholdHonestyStatus({
      setting: {
        threshold: shopMoney,
        shopifySnapshot: { freeShippingMinSubtotal: shopMoney },
        shopifyObservationError: null,
      },
      conflictCount: 0,
    });
    expect(status).toEqual({ kind: "matches" });
  });

  it("reports differs when SyncResult leaf count is positive", () => {
    const status = announcementThresholdHonestyStatus({
      setting: {
        threshold: localMoney,
        shopifySnapshot: { freeShippingMinSubtotal: shopMoney },
        shopifyObservationError: null,
      },
      conflictCount: 1,
    });
    expect(status).toEqual({ kind: "differs" });
  });

  it("surfaces the observation error when the snapshot amount is missing", () => {
    const status = announcementThresholdHonestyStatus({
      setting: {
        threshold: null,
        shopifySnapshot: null,
        shopifyObservationError: "Missing Shopify permission: read_shipping (cannot read delivery profiles).",
      },
      conflictCount: 0,
    });
    expect(status).toEqual({
      kind: "reason",
      message: "Missing Shopify permission: read_shipping (cannot read delivery profiles).",
    });
  });

  it("surfaces the observation error even when a prior snapshot amount still exists", () => {
    const status = announcementThresholdHonestyStatus({
      setting: {
        threshold: shopMoney,
        shopifySnapshot: { freeShippingMinSubtotal: shopMoney },
        shopifyObservationError: "Missing Shopify permission: read_shipping (cannot read delivery profiles).",
      },
      conflictCount: 0,
    });
    expect(status).toEqual({
      kind: "reason",
      message: "Missing Shopify permission: read_shipping (cannot read delivery profiles).",
    });
  });

  it("stays unchecked only when there is no snapshot and no error", () => {
    const status = announcementThresholdHonestyStatus({
      setting: {
        threshold: null,
        shopifySnapshot: null,
        shopifyObservationError: null,
      },
      conflictCount: 0,
    });
    expect(status).toEqual({ kind: "unchecked" });
  });
});
