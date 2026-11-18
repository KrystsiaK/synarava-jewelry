/**
 * Guard: free-shipping threshold is a SHOP compare leaf resolved only via
 * ConflictResolver Apply (Take Shopify → OUR working `threshold`).
 * Never snapshot-only bypass; never push to Shopify.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readAnnouncementBarSetting: vi.fn(),
  adoptFreeShippingThresholdFromShopify: vi.fn(),
  recheckEntityConflictLeaves: vi.fn(),
  gateWriteConvergence: vi.fn(),
}));

vi.mock("@/lib/content/announcement-bar", () => ({
  adoptFreeShippingThresholdFromShopify: mocks.adoptFreeShippingThresholdFromShopify,
  readAnnouncementBarSetting: mocks.readAnnouncementBarSetting,
  deriveFreeShippingThresholdWindow: (setting: { threshold: unknown }) => ({
    freeShippingMinSubtotal: setting.threshold,
  }),
}));

vi.mock("@/lib/sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sync")>("@/lib/sync");
  return {
    ...actual,
    recheckEntityConflictLeaves: mocks.recheckEntityConflictLeaves,
    gateWriteConvergence: mocks.gateWriteConvergence,
    findConflictLeaf: actual.findConflictLeaf,
    leafMatchesExpectedFingerprints: actual.leafMatchesExpectedFingerprints,
    intendedAddressFromLeaf: actual.intendedAddressFromLeaf,
  };
});

import { compareSyncState } from "@/lib/sync/compare";
import { FREE_SHIPPING_THRESHOLD_RESOURCE_ID } from "@/lib/content/announcement-bar-fields";
import { resolveAnnouncementBarText } from "@/lib/content/announcement-bar-display";
import { applyShopCommerceField } from "@/lib/shopify/shop-commerce-field-apply";

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

const shopMoney = { amount: "45.0", currencyCode: "EUR" };
const ourMoney = { amount: "40.0", currencyCode: "EUR" };

describe("free-shipping threshold Apply guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.gateWriteConvergence.mockResolvedValue({ ok: true });
  });

  it("shows the SHOP leaf in compare when OUR working copy diverges", () => {
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "SHOP",
        resourceId: FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
        ourWindow: { freeShippingMinSubtotal: ourMoney },
        shopifySnapshot: { freeShippingMinSubtotal: shopMoney },
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
    const leaves = result.leaves.filter((leaf) => leaf.kind === "commerce" && leaf.resourceType === "SHOP");
    expect(leaves.length).toBeGreaterThan(0);
    expect(leaves.every((leaf) => leaf.contractKey === "shop.freeShippingMinSubtotal")).toBe(true);
    for (const leaf of leaves) {
      expect(leaf.allowedDirections).toEqual(["SHOPIFY_TO_SYNARAVA"]);
    }
  });

  it("Apply Take Shopify writes OUR threshold; Keep ours is refused", async () => {
    const leaf = {
      id: "SHOP:shop-free-shipping:commerce:freeShippingMinSubtotal",
      resourceType: "SHOP" as const,
      resourceId: FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
      kind: "commerce" as const,
      locale: null,
      fieldKey: "commerce:freeShippingMinSubtotal",
      label: "Free shipping threshold",
      synaravaValue: "40.0 EUR",
      shopifyValue: "45.0 EUR",
      allowedDirections: ["SHOPIFY_TO_SYNARAVA"] as const,
      blockedReason: null,
      sourceId: null,
      path: "freeShippingMinSubtotal",
      contractKey: "shop.freeShippingMinSubtotal",
      section: "shopify" as const,
      parts: null,
      presenceSide: null,
      targetKind: "commerce" as const,
      localFingerprint: "local-fp",
      shopifyFingerprint: "shop-fp",
      node: "base" as const,
    };
    mocks.recheckEntityConflictLeaves.mockResolvedValue({ leaves: [leaf] });
    mocks.adoptFreeShippingThresholdFromShopify.mockResolvedValue({
      enabled: true,
      threshold: shopMoney,
      shopifySnapshot: { freeShippingMinSubtotal: shopMoney },
      shopifyObservationError: null,
      shopifyObservationSource: {
        profileName: "General",
        zoneName: "Portugal",
        rateName: "Free shipping",
      },
      shopifyObservationWarning: null,
    });

    const take = await applyShopCommerceField({
      shopId: FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
      label: "Free shipping threshold",
      fieldKey: leaf.fieldKey,
      direction: "SHOPIFY_TO_SYNARAVA",
      expectedLocalFingerprint: "local-fp",
      expectedShopifyFingerprint: "shop-fp",
      requestedBy: "admin",
    });
    expect(take.ok).toBe(true);
    expect(mocks.adoptFreeShippingThresholdFromShopify).toHaveBeenCalledTimes(1);

    const keep = await applyShopCommerceField({
      shopId: FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
      label: "Free shipping threshold",
      fieldKey: leaf.fieldKey,
      direction: "SYNARAVA_TO_SHOPIFY",
      expectedLocalFingerprint: "local-fp",
      expectedShopifyFingerprint: "shop-fp",
      requestedBy: "admin",
    });
    expect(keep.ok).toBe(false);
    if (!keep.ok) expect(keep.reason).toBe("UNSUPPORTED");
  });

  it("does not write OUR threshold without Apply (refresh leaves working copy alone)", async () => {
    // Contract: adopt is only called from applyShopCommerceField / ConflictResolver Apply.
    expect(mocks.adoptFreeShippingThresholdFromShopify).not.toHaveBeenCalled();
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("lib/sync/refresh-shopify-state.ts", "utf8"),
    );
    expect(source).toMatch(/refreshAnnouncementBarShopifySnapshot/);
    expect(source).not.toMatch(/adoptFreeShippingThresholdFromShopify/);
  });

  it("uses one threshold-read mechanism (selectPortugalFreeShippingThreshold) with no bypass", async () => {
    const fs = await import("node:fs");
    const reader = fs.readFileSync("lib/shopify/free-shipping-threshold.ts", "utf8");
    const refresh = fs.readFileSync("lib/sync/refresh-shopify-state.ts", "utf8");
    expect(reader).toMatch(/export function selectPortugalFreeShippingThreshold/);
    expect(reader).toMatch(/selectPortugalFreeShippingThreshold\(/);
    expect(reader).toMatch(/collectPortugalFreeShippingCandidates\(/);
    // Waterfall refresh is the only writer of the observation — via the shared helper.
    expect(refresh).toMatch(/refreshFreeShippingThresholdShopifyState/);
    expect(refresh).not.toMatch(/fetchPortugalFreeShippingThreshold/);
    expect(refresh).not.toMatch(/deliveryProfiles/);
  });

  it("storefront banner reads OUR working threshold, not snapshot-only", () => {
    const fromOurs = resolveAnnouncementBarText({
      enabled: true,
      threshold: ourMoney,
      template: "Free shipping from {amount}",
      locale: "en",
    });
    expect(fromOurs).toBe("Free shipping from €40.00");

    // Snapshot alone is not the banner input — missing OUR threshold hides the bar.
    const withoutOurs = resolveAnnouncementBarText({
      enabled: true,
      threshold: null,
      template: "Free shipping from {amount}",
      locale: "en",
    });
    expect(withoutOurs).toBeNull();
  });
});
