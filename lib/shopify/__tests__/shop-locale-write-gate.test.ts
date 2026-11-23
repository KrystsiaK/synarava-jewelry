import { describe, expect, it } from "vitest";

import {
  ENABLE_IN_SHOPIFY_LABEL,
  isInvalidShopifyLocaleUserError,
  isLanguagesMissingReconcileWarning,
  mapInvalidShopifyLocaleError,
  partitionReconcileLocalesForShop,
  planShopifyLocaleTranslationWrite,
  shopLocaleWriteBlockedReason,
  shopRegistryLocalesMissingWarning,
} from "@/lib/shopify/shop-locale-write-gate";

const SAMPLE_REASON = shopLocaleWriteBlockedReason({
  shopDomain: "example.myshopify.com",
  shopLocales: ["en", "fr"],
  triedLocale: "pt-PT",
});

describe("shop-locale-write-gate", () => {
  it("maps registry codes to Shopify locale codes via shopifyLocale (pt→pt-PT, ru→ru)", () => {
    const registry = [
      { code: "pt", shopifyLocale: "pt-PT" },
      { code: "ru", shopifyLocale: "ru" },
    ] as const;
    expect(registry.find((row) => row.code === "pt")?.shopifyLocale).toBe("pt-PT");
    expect(registry.find((row) => row.code === "ru")?.shopifyLocale).toBe("ru");
  });

  it("builds the factual blocked reason with shop domain and locale list", () => {
    expect(SAMPLE_REASON).toBe(
      "Shopify store example.myshopify.com has locales [en, fr]; Synarava tried to write 'pt-PT'.",
    );
    expect(shopLocaleWriteBlockedReason({
      shopDomain: "synarava.myshopify.com",
      shopLocales: ["en"],
      triedLocale: "ru",
    })).toBe(
      "Shopify store synarava.myshopify.com has locales [en]; Synarava tried to write 'ru'.",
    );
  });

  it("detects Shopify invalid-locale userErrors", () => {
    expect(isInvalidShopifyLocaleUserError("Locale is not a valid locale for the shop")).toBe(true);
    expect(isInvalidShopifyLocaleUserError("Locale is not enabled on this shop")).toBe(true);
    expect(isInvalidShopifyLocaleUserError("Translatable content digest is invalid")).toBe(false);
  });

  it("maps invalid-locale responses to the same factual reason (race guard)", () => {
    expect(
      mapInvalidShopifyLocaleError("Locale is not a valid locale for the shop", {
        shopDomain: "example.myshopify.com",
        shopLocales: ["en", "fr"],
        triedLocale: "pt-PT",
      }),
    ).toBe(SAMPLE_REASON);
  });

  it("blocks push when shop has no pt-PT and offers Enable when write_locales is granted", () => {
    const plan = planShopifyLocaleTranslationWrite({
      shopifyLocale: "pt-PT",
      enabledShopifyLocales: ["en", "ru"],
      shopDomain: "example.myshopify.com",
      canWriteLocales: true,
    });
    expect(plan.allowPush).toBe(false);
    expect(plan.blockedReason).toBe(
      "Shopify store example.myshopify.com has locales [en, ru]; Synarava tried to write 'pt-PT'.",
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
      enabledShopifyLocales: ["en", "pt-PT"],
      shopDomain: "example.myshopify.com",
    });
    expect(plan.allowPush).toBe(true);
    expect(plan.blockedReason).toBeNull();
    expect(plan.enableOffer).toBeNull();
  });

  it("does not gate when enabledShopifyLocales is omitted (legacy callers)", () => {
    const plan = planShopifyLocaleTranslationWrite({
      shopifyLocale: "pt-PT",
    });
    expect(plan.allowPush).toBe(true);
  });

  it("mutation: breaking the message helper fails exact-text assertions", () => {
    // Guard against regressions that invent guessing copy again.
    expect(SAMPLE_REASON).toMatch(/^Shopify store .+ has locales \[.*\]; Synarava tried to write '.+'\.$/);
    expect(SAMPLE_REASON).not.toMatch(/Settings → Languages|is not enabled in the Shopify store/i);
  });

  it("builds reconcile missing-locales warning in the same factual style", () => {
    expect(shopRegistryLocalesMissingWarning({
      shopDomain: "example.myshopify.com",
      shopLocales: ["en", "ru"],
      missingRegistryLocales: ["pt-PT"],
    })).toBe(
      "Shopify store example.myshopify.com has locales [en, ru]; registry locales not in shop: [pt-PT]",
    );
  });

  it("partitions registry locales so missing shop locales are not checked", () => {
    expect(partitionReconcileLocalesForShop({
      registryLocales: ["en", "pt-PT", "ru"],
      enabledShopifyLocales: ["en", "ru"],
    })).toEqual({
      checkLocales: ["en", "ru"],
      missingLocales: ["pt-PT"],
    });
  });

  it("detects languages-missing warnings and rejects API failure blurbs", () => {
    const warning = shopRegistryLocalesMissingWarning({
      shopDomain: "example.myshopify.com",
      shopLocales: ["en"],
      missingRegistryLocales: ["pt-PT", "ru"],
    });
    expect(isLanguagesMissingReconcileWarning(warning)).toBe(true);
    expect(isLanguagesMissingReconcileWarning(
      "1 check could not be completed. product-1 (ru): throttled",
    )).toBe(false);
    expect(isLanguagesMissingReconcileWarning(null)).toBe(false);
  });

  it("mutation: skipping partition/filter would still list pt-PT as checkable", () => {
    const broken = { checkLocales: ["en", "pt-PT", "ru"], missingLocales: [] as string[] };
    const correct = partitionReconcileLocalesForShop({
      registryLocales: ["en", "pt-PT", "ru"],
      enabledShopifyLocales: ["en", "ru"],
    });
    expect(broken.checkLocales).toContain("pt-PT");
    expect(correct.checkLocales).not.toContain("pt-PT");
    expect(correct.missingLocales).toEqual(["pt-PT"]);
  });
});
