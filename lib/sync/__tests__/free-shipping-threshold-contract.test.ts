import { describe, expect, it } from "vitest";

import { diffShopifyProjections } from "@/lib/shopify/shopify-projection-diff";
import { compareSyncState } from "@/lib/sync/compare";
import {
  SHOP_COMMERCE_FIELDS,
  lookupContractForPath,
  labelForWindowPath,
} from "@/lib/sync/field-registry";
import { FREE_SHIPPING_THRESHOLD_RESOURCE_ID } from "@/lib/content/announcement-bar-fields";

const LOCALES = [
  {
    code: "en",
    shopifyLocale: "en",
    name: "English",
    nativeName: "English",
    isDefault: true,
    sortOrder: 0,
  },
] as const;

const money = { amount: "45.0", currencyCode: "EUR" };

describe("shop.freeShippingMinSubtotal field contract", () => {
  it("registers the Shopify-owned money field", () => {
    const field = SHOP_COMMERCE_FIELDS.find((entry) => entry.key === "freeShippingMinSubtotal");
    expect(field).toMatchObject({
      contractKey: "shop.freeShippingMinSubtotal",
      ownership: "shopify",
      valueType: "money",
      applyToSynarava: "scoped",
      applyToShopify: "unsupported",
    });
    expect(lookupContractForPath("freeShippingMinSubtotal", "SHOP")?.contractKey)
      .toBe("shop.freeShippingMinSubtotal");
    expect(labelForWindowPath("freeShippingMinSubtotal.amount", "SHOP"))
      .toBe("Free shipping threshold");
  });

  it("round-trips identical windows to zero commerce leaves", () => {
    const window = { freeShippingMinSubtotal: money };
    expect(diffShopifyProjections(window, window)).toEqual([]);

    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "SHOP",
        resourceId: FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
        ourWindow: window,
        shopifySnapshot: window,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-11-17T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-11-17T12:01:00.000Z"),
    });

    expect(result.leaves.filter((leaf) => leaf.kind === "commerce")).toEqual([]);
  });

  it("emits a Take-Shopify-only leaf when Shopify threshold diverges", () => {
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "SHOP",
        resourceId: FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
        ourWindow: { freeShippingMinSubtotal: { amount: "40.0", currencyCode: "EUR" } },
        shopifySnapshot: { freeShippingMinSubtotal: money },
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-11-17T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-11-17T12:01:00.000Z"),
    });

    const leaves = result.leaves.filter((leaf) => leaf.kind === "commerce");
    expect(leaves.length).toBeGreaterThan(0);
    expect(leaves.every((leaf) => leaf.resourceType === "SHOP")).toBe(true);
    // Money deepDiff may emit amount + currencyCode child paths; each must be Take Shopify only.
    for (const leaf of leaves) {
      expect(leaf.allowedDirections, JSON.stringify(leaf)).toEqual(["SHOPIFY_TO_SYNARAVA"]);
    }
  });
});
