import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    siteSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
  return {
    tx,
    siteSettingFindUnique: vi.fn(),
    siteSettingUpsert: vi.fn(),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    siteSetting: {
      findUnique: mocks.siteSettingFindUnique,
      upsert: mocks.siteSettingUpsert,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  assertShopifyStoreBinding,
  classifyShopifyStoreBinding,
  ensureShopifyStoreBinding,
} from "@/lib/shopify/store-binding";
import { ShopifyAdminError } from "@/lib/shopify/admin";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.siteSettingFindUnique.mockResolvedValue(null);
  mocks.tx.siteSetting.findUnique.mockResolvedValue(null);
  mocks.tx.siteSetting.upsert.mockResolvedValue({});
  mocks.siteSettingUpsert.mockResolvedValue({});
});

describe("classifyShopifyStoreBinding", () => {
  it("initializes an unbound installation", () => {
    expect(classifyShopifyStoreBinding(null, "New-Shop.myshopify.com/"))
      .toEqual({ status: "UNBOUND", currentShopDomain: "new-shop.myshopify.com" });
  });

  it("accepts the same canonical shop domain", () => {
    expect(classifyShopifyStoreBinding("new-shop.myshopify.com", "https://NEW-SHOP.myshopify.com"))
      .toEqual({ status: "MATCH", currentShopDomain: "new-shop.myshopify.com" });
  });

  it("detects a credential mismatch without mutating", () => {
    expect(classifyShopifyStoreBinding("old-shop.myshopify.com", "new-shop.myshopify.com"))
      .toEqual({
        status: "MISMATCH",
        boundShopDomain: "old-shop.myshopify.com",
        currentShopDomain: "new-shop.myshopify.com",
      });
  });
});

describe("ensureShopifyStoreBinding", () => {
  it("binds on first manual check (clean DB)", async () => {
    const result = await ensureShopifyStoreBinding("https://Synarava.myshopify.com/");
    expect(result).toEqual({ status: "MATCH", currentShopDomain: "synarava.myshopify.com" });
    expect(mocks.tx.siteSetting.upsert).toHaveBeenCalledWith({
      where: { key: "shopify.store_binding" },
      update: { value: { shopDomain: "synarava.myshopify.com" } },
      create: { key: "shopify.store_binding", value: { shopDomain: "synarava.myshopify.com" } },
    });
  });

  it("second check is idempotent (MATCH → no write)", async () => {
    mocks.siteSettingFindUnique.mockResolvedValue({
      value: { shopDomain: "synarava.myshopify.com" },
    });
    const result = await ensureShopifyStoreBinding("synarava.myshopify.com");
    expect(result.status).toBe("MATCH");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.tx.siteSetting.upsert).not.toHaveBeenCalled();
  });

  it("mismatch never overwrites the bound domain", async () => {
    mocks.siteSettingFindUnique.mockResolvedValue({
      value: { shopDomain: "old-shop.myshopify.com" },
    });
    await expect(ensureShopifyStoreBinding("new-shop.myshopify.com"))
      .rejects.toBeInstanceOf(ShopifyAdminError);
    await expect(ensureShopifyStoreBinding("new-shop.myshopify.com"))
      .rejects.toThrow(/linked to old-shop\.myshopify\.com/);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.tx.siteSetting.upsert).not.toHaveBeenCalled();
    expect(mocks.siteSettingUpsert).not.toHaveBeenCalled();
  });

  it("concurrent bind to a different domain inside the transaction fails closed", async () => {
    mocks.siteSettingFindUnique.mockResolvedValue(null);
    mocks.tx.siteSetting.findUnique.mockResolvedValue({
      value: { shopDomain: "other-shop.myshopify.com" },
    });
    await expect(ensureShopifyStoreBinding("synarava.myshopify.com"))
      .rejects.toThrow(/linked to other-shop\.myshopify\.com/);
    expect(mocks.tx.siteSetting.upsert).not.toHaveBeenCalled();
  });
});

describe("assertShopifyStoreBinding", () => {
  it("blocks Push before binding (UNBOUND)", async () => {
    await expect(assertShopifyStoreBinding("synarava.myshopify.com"))
      .rejects.toThrow(/top bar once to bind/);
  });

  it("allows Push when already bound to the same shop", async () => {
    mocks.siteSettingFindUnique.mockResolvedValue({
      value: { shopDomain: "synarava.myshopify.com" },
    });
    await expect(assertShopifyStoreBinding("synarava.myshopify.com"))
      .resolves.toEqual({ status: "MATCH", currentShopDomain: "synarava.myshopify.com" });
  });

  it("blocks Push on mismatch without writing", async () => {
    mocks.siteSettingFindUnique.mockResolvedValue({
      value: { shopDomain: "old-shop.myshopify.com" },
    });
    await expect(assertShopifyStoreBinding("new-shop.myshopify.com"))
      .rejects.toThrow(/linked to old-shop\.myshopify\.com/);
    expect(mocks.siteSettingUpsert).not.toHaveBeenCalled();
  });
});
