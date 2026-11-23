import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
  getShopifyShopLocalesSnapshot: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

vi.mock("@/lib/shopify/shop-locales-cache", () => ({
  getShopifyShopLocalesSnapshot: mocks.getShopifyShopLocalesSnapshot,
  getEnabledShopifyLocaleCodes: vi.fn(),
  getShopifyShopLocales: vi.fn(),
  invalidateShopifyShopLocalesCache: vi.fn(),
}));

import { registerTranslations } from "@/lib/shopify/translations";
import { shopLocaleWriteBlockedReason } from "@/lib/shopify/shop-locale-write-gate";

const SHOP_DOMAIN = "example.myshopify.com";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerTranslations shop locale gate", () => {
  it("shop without pt → 0 translationsRegister calls for pt-PT", async () => {
    mocks.getShopifyShopLocalesSnapshot.mockResolvedValue({
      shopDomain: SHOP_DOMAIN,
      locales: [{ locale: "en" }, { locale: "ru" }],
      localeCodes: ["en", "ru"],
    });

    const reason = shopLocaleWriteBlockedReason({
      shopDomain: SHOP_DOMAIN,
      shopLocales: ["en", "ru"],
      triedLocale: "pt-PT",
    });

    await expect(
      registerTranslations({
        resourceId: "gid://shopify/Product/1",
        locale: "pt-PT",
        values: { title: "Anel" },
      }),
    ).rejects.toThrow(reason);

    expect(mocks.shopifyAdminRequest).not.toHaveBeenCalled();
  });

  it("shop with pt-PT → sends locale pt-PT (not bare pt)", async () => {
    mocks.getShopifyShopLocalesSnapshot.mockResolvedValue({
      shopDomain: SHOP_DOMAIN,
      locales: [{ locale: "en" }, { locale: "pt-PT" }],
      localeCodes: ["en", "pt-PT"],
    });
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

  it("maps Shopify 'not a valid locale' to the clear factual reason", async () => {
    // Race: gate saw locale enabled, Shopify then rejected.
    mocks.getShopifyShopLocalesSnapshot.mockResolvedValue({
      shopDomain: SHOP_DOMAIN,
      locales: [{ locale: "en" }, { locale: "pt-PT" }],
      localeCodes: ["en", "pt-PT"],
    });
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
    ).rejects.toThrow(
      shopLocaleWriteBlockedReason({
        shopDomain: SHOP_DOMAIN,
        shopLocales: ["en", "pt-PT"],
        triedLocale: "pt-PT",
      }),
    );
  });
});
