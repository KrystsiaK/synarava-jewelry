import { describe, expect, it } from "vitest";

import {
  ENABLE_IN_SHOPIFY_LABEL,
  isInvalidShopifyLocaleUserError,
  mapInvalidShopifyLocaleError,
  planShopifyLocaleTranslationWrite,
  shopLocaleNotEnabledReason,
} from "@/lib/shopify/shop-locale-write-gate";

describe("shop-locale-write-gate", () => {
  it("maps registry codes to Shopify locale codes via shopifyLocale (pt→pt-PT, ru→ru)", () => {
    const registry = [
      { code: "pt", shopifyLocale: "pt-PT" },
      { code: "ru", shopifyLocale: "ru" },
    ] as const;
    expect(registry.find((row) => row.code === "pt")?.shopifyLocale).toBe("pt-PT");
    expect(registry.find((row) => row.code === "ru")?.shopifyLocale).toBe("ru");
  });

  it("builds the locale-specific blocked reason", () => {
    expect(shopLocaleNotEnabledReason("pt")).toBe(
      "PT is not enabled in the Shopify store (Settings → Languages)",
    );
    expect(shopLocaleNotEnabledReason("ru")).toBe(
      "RU is not enabled in the Shopify store (Settings → Languages)",
    );
  });

  it("detects Shopify invalid-locale userErrors", () => {
    expect(isInvalidShopifyLocaleUserError("Locale is not a valid locale for the shop")).toBe(true);
    expect(isInvalidShopifyLocaleUserError("Locale is not enabled on this shop")).toBe(true);
    expect(isInvalidShopifyLocaleUserError("Translatable content digest is invalid")).toBe(false);
  });

  it("maps invalid-locale responses to the same human reason (race guard)", () => {
    expect(
      mapInvalidShopifyLocaleError("Locale is not a valid locale for the shop", "pt"),
    ).toBe("PT is not enabled in the Shopify store (Settings → Languages)");
  });

  it("blocks push when shop has no pt-PT and offers Enable when write_locales is granted", () => {
    const plan = planShopifyLocaleTranslationWrite({
      shopifyLocale: "pt-PT",
      displayCode: "pt",
      enabledShopifyLocales: new Set(["en", "ru"]),
      canWriteLocales: true,
    });
    expect(plan.allowPush).toBe(false);
    expect(plan.blockedReason).toBe(
      "PT is not enabled in the Shopify store (Settings → Languages)",
    );
    expect(plan.enableOffer).toEqual({
      kind: "ENABLE_SHOPIFY_LOCALE",
      label: ENABLE_IN_SHOPIFY_LABEL,
      shopifyLocale: "pt-PT",
    });
  });

  it("allows push when shop has pt-PT enabled", () => {
    const plan = planShopifyLocaleTranslationWrite({
      shopifyLocale: "pt-PT",
      displayCode: "pt",
      enabledShopifyLocales: new Set(["en", "pt-pt"]),
    });
    expect(plan.allowPush).toBe(true);
    expect(plan.blockedReason).toBeNull();
    expect(plan.enableOffer).toBeNull();
  });

  it("does not gate when enabledShopifyLocales is omitted (legacy callers)", () => {
    const plan = planShopifyLocaleTranslationWrite({
      shopifyLocale: "pt-PT",
      displayCode: "pt",
    });
    expect(plan.allowPush).toBe(true);
  });
});
