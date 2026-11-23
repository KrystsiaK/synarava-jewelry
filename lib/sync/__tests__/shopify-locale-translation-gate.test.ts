/**
 * Shop-enabled locale gate on translation write leaves (compare plan).
 * Mutation proof: removing enabledShopifyLocales gating fails these tests.
 */

import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";
import { shopLocaleWriteBlockedReason } from "@/lib/shopify/shop-locale-write-gate";

const LOCALES = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
  { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
  { code: "ru", shopifyLocale: "ru", name: "Russian", nativeName: "Русский", isDefault: false, sortOrder: 2 },
] as const;

const PT_DIFF = {
  id: "div-pt",
  rootEntityType: "PRODUCT" as const,
  rootEntityId: "p1",
  locale: "pt-PT",
  fieldKey: "title",
  fieldLabel: "Title",
  kind: "CONFLICT" as const,
  localValue: "Anel",
  shopifyValue: "Ring",
  localFingerprint: "a",
  shopifyFingerprint: "b",
  targetKind: "NATIVE" as const,
};

const SHOP_DOMAIN = "example.myshopify.com";

function compare(enabledShopifyLocales: readonly string[] | null | undefined, canWrite = false) {
  return compareSyncState({
    commerceWindows: [],
    translationDifferences: [PT_DIFF],
    productPresence: [],
    collectionPresence: [],
    locales: [...LOCALES],
    enabledShopifyLocales,
    shopDomain: SHOP_DOMAIN,
    canWriteShopifyLocales: canWrite,
    connected: true,
    checkedAt: "2026-10-23T10:00:00.000Z",
    runStatus: "SUCCEEDED",
    now: new Date("2026-10-23T10:01:00.000Z"),
  });
}

describe("compareSyncState shopify locale translation gate", () => {
  it("blocks PT Synarava→Shopify leaves when shop has no pt-PT", () => {
    const result = compare(["en", "ru"], true);
    const leaf = result.leaves.find((item) => item.kind === "translation");
    const reason = shopLocaleWriteBlockedReason({
      shopDomain: SHOP_DOMAIN,
      shopLocales: ["en", "ru"],
      triedLocale: "pt-PT",
    });
    expect(leaf).toMatchObject({
      locale: "pt",
      fieldKey: "translation:pt-PT:title",
      blockedReason: reason,
      allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
    });
    expect(leaf?.allowedDirections).not.toContain("SYNARAVA_TO_SHOPIFY");
    expect(leaf?.blockedOffer).toEqual({
      kind: "ENABLE_SHOPIFY_LOCALE",
      label: "Enable in Shopify",
      shopifyLocale: "pt-PT",
    });
  });

  it("sends pt-PT field addresses when shop has pt-PT enabled", () => {
    const result = compare(["en", "pt-PT"]);
    const leaf = result.leaves.find((item) => item.kind === "translation");
    expect(leaf).toMatchObject({
      fieldKey: "translation:pt-PT:title",
      blockedReason: null,
      allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    });
    expect(leaf?.blockedOffer ?? null).toBeNull();
  });

  it("mutation: ungated compare still offers Synarava→Shopify for missing shop locale", () => {
    // Old behavior = omit enabledShopifyLocales → push remains selectable.
    const ungated = compare(undefined);
    expect(ungated.leaves[0]?.allowedDirections).toContain("SYNARAVA_TO_SHOPIFY");
    expect(ungated.leaves[0]?.blockedReason).toBeNull();

    const gated = compare(["en"]);
    expect(gated.leaves[0]?.allowedDirections).not.toContain("SYNARAVA_TO_SHOPIFY");
    expect(gated.leaves[0]?.blockedReason).toBe(
      shopLocaleWriteBlockedReason({
        shopDomain: SHOP_DOMAIN,
        shopLocales: ["en"],
        triedLocale: "pt-PT",
      }),
    );
  });
});
