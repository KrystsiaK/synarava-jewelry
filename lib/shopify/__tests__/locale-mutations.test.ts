import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ shopifyAdminRequest: vi.fn() }));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
}));

import {
  hasWriteLocalesScope,
  shopLocaleDisable,
  shopLocaleEnable,
  shopLocaleUpdate,
  WRITE_LOCALES_SCOPE,
} from "@/lib/shopify/locale-mutations";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("locale mutations", () => {
  it("detects write_locales from granted scopes", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      currentAppInstallation: {
        accessScopes: [{ handle: "read_locales" }, { handle: WRITE_LOCALES_SCOPE }],
      },
    });
    expect(await hasWriteLocalesScope()).toBe(true);
  });

  it("enables, updates, and disables locales via Admin API mutations", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        shopLocaleEnable: {
          userErrors: [],
          shopLocale: { locale: "de", name: "German", primary: false, published: false },
        },
      })
      .mockResolvedValueOnce({
        shopLocaleUpdate: {
          userErrors: [],
          shopLocale: { locale: "de", name: "German", primary: false, published: true },
        },
      })
      .mockResolvedValueOnce({
        shopLocaleDisable: { userErrors: [], locale: "de" },
      });

    expect(await shopLocaleEnable("de")).toEqual(
      expect.objectContaining({ locale: "de", published: false }),
    );
    expect(await shopLocaleUpdate("de", true)).toEqual(
      expect.objectContaining({ locale: "de", published: true }),
    );
    expect(await shopLocaleDisable("de")).toBe("de");
  });
});
