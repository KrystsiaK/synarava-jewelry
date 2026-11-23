import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
  getEnabledShopifyLocaleCodes: vi.fn(),
  getStorefrontLocales: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

vi.mock("@/lib/shopify/shop-locales-cache", () => ({
  getEnabledShopifyLocaleCodes: mocks.getEnabledShopifyLocaleCodes,
  getShopifyShopLocales: vi.fn(),
  invalidateShopifyShopLocalesCache: vi.fn(),
}));

vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getStorefrontLocales: mocks.getStorefrontLocales,
}));

import { registerTranslations } from "@/lib/shopify/translations";
import { shopLocaleNotEnabledReason } from "@/lib/shopify/shop-locale-write-gate";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStorefrontLocales.mockResolvedValue([
    { code: "en", shopifyLocale: "en", isDefault: true },
    { code: "pt", shopifyLocale: "pt-PT", isDefault: false },
    { code: "ru", shopifyLocale: "ru", isDefault: false },
  ]);
});

describe("registerTranslations shop locale gate", () => {
  it("shop without pt → 0 translationsRegister calls for pt-PT", async () => {
    mocks.getEnabledShopifyLocaleCodes.mockResolvedValue(new Set(["en", "ru"]));

    await expect(
      registerTranslations({
        resourceId: "gid://shopify/Product/1",
        locale: "pt-PT",
        values: { title: "Anel" },
      }),
    ).rejects.toThrow(shopLocaleNotEnabledReason("pt"));

    expect(mocks.shopifyAdminRequest).not.toHaveBeenCalled();
  });

  it("shop with pt-PT → sends locale pt-PT (not bare pt)", async () => {
    mocks.getEnabledShopifyLocaleCodes.mockResolvedValue(new Set(["en", "pt-pt"]));
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [{ key: "title", digest: "d1" }] } })
      .mockResolvedValueOnce({
        translationsRegister: { userErrors: [], translations: [{ key: "title", value: "Anel" }] },
      });

    await expect(
      registerTranslations({
        resourceId: "gid://shopify/Product/1",
        locale: "pt-PT",
        values: { title: "Anel" },
      }),
    ).resolves.toEqual({ registeredKeys: ["title"] });

    const registerCall = mocks.shopifyAdminRequest.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("translationsRegister"),
    );
    expect(registerCall?.[1]).toMatchObject({
      translations: [expect.objectContaining({ locale: "pt-PT", key: "title", value: "Anel" })],
    });
  });

  it("maps Shopify 'not a valid locale' to the clear human reason", async () => {
    // Race: gate saw locale enabled, Shopify then rejected.
    mocks.getEnabledShopifyLocaleCodes.mockResolvedValue(new Set(["en", "pt-pt"]));
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [{ key: "title", digest: "d1" }] } })
      .mockResolvedValueOnce({
        translationsRegister: {
          userErrors: [{ message: "Locale is not a valid locale for the shop" }],
        },
      });

    await expect(
      registerTranslations({
        resourceId: "gid://shopify/Product/1",
        locale: "pt-PT",
        values: { title: "Anel" },
      }),
    ).rejects.toThrow(shopLocaleNotEnabledReason("pt"));
  });
});
