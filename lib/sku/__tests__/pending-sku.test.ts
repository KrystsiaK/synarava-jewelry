import { describe, expect, it } from "vitest";
import {
  createPendingCommerceSku,
  isPendingCommerceSku,
  isShopifyInventPlaceholderSku,
  localSkuForEmptyShopifySku,
  needsSkuAssignment,
} from "@/lib/sku/pending-sku";

describe("isPendingCommerceSku / needsSkuAssignment", () => {
  it("treats blank as pending", () => {
    expect(isPendingCommerceSku("")).toBe(true);
    expect(isPendingCommerceSku("   ")).toBe(true);
  });

  it("detects PENDING placeholders and legacy draft invent tokens", () => {
    expect(isPendingCommerceSku("PENDING-m1abc2-xyz9")).toBe(true);
    expect(isPendingCommerceSku("PENDING-p16079211397451-v58824796668235")).toBe(true);
    expect(isPendingCommerceSku("SKU-m1abc2-xyz9")).toBe(true);
  });

  it("treats any SHOPIFY-* invent as assignable (M2 Kiryl SKU)", () => {
    expect(isPendingCommerceSku("SHOPIFY-123456")).toBe(true);
    expect(isPendingCommerceSku("SHOPIFY-123456-789")).toBe(true);
    expect(needsSkuAssignment("SHOPIFY-16079211397451-58824796668235")).toBe(true);
    expect(isShopifyInventPlaceholderSku("SHOPIFY-16079211397451-58824796668235")).toBe(true);
  });

  it("does not flag policy SKUs", () => {
    expect(isPendingCommerceSku("JW-NECK-007")).toBe(false);
    expect(isPendingCommerceSku("BA-CH-001")).toBe(false);
    expect(needsSkuAssignment("JW-NECK-042")).toBe(false);
  });
});

describe("createPendingCommerceSku", () => {
  it("uppercases pending token from factory", () => {
    expect(createPendingCommerceSku(() => "pending-aa-bb")).toBe("PENDING-AA-BB");
  });
});

describe("localSkuForEmptyShopifySku", () => {
  it("invents PENDING-* from product + variant GIDs", () => {
    expect(
      localSkuForEmptyShopifySku({
        shopifyProductId: "gid://shopify/Product/16079211397451",
        shopifyVariantId: "gid://shopify/ProductVariant/58824796668235",
      }),
    ).toBe("PENDING-p16079211397451-v58824796668235");
  });

  it("invents product-level PENDING when variant id missing", () => {
    expect(
      localSkuForEmptyShopifySku({
        shopifyProductId: "gid://shopify/Product/99",
        shopifyVariantId: null,
      }),
    ).toBe("PENDING-p99-sku");
  });
});
