import { describe, expect, it } from "vitest";
import { createPendingCommerceSku, isPendingCommerceSku } from "@/lib/sku/pending-sku";

describe("isPendingCommerceSku", () => {
  it("treats blank as pending", () => {
    expect(isPendingCommerceSku("")).toBe(true);
    expect(isPendingCommerceSku("   ")).toBe(true);
  });

  it("detects PENDING placeholders and legacy draft invent tokens", () => {
    expect(isPendingCommerceSku("PENDING-m1abc2-xyz9")).toBe(true);
    expect(isPendingCommerceSku("SKU-m1abc2-xyz9")).toBe(true);
  });

  it("does not flag policy SKUs or Shopify identity fallbacks", () => {
    expect(isPendingCommerceSku("JW-NECK-007")).toBe(false);
    expect(isPendingCommerceSku("SHOPIFY-123456")).toBe(false);
    expect(isPendingCommerceSku("BA-CH-001")).toBe(false);
  });
});

describe("createPendingCommerceSku", () => {
  it("uppercases pending token from factory", () => {
    expect(createPendingCommerceSku(() => "pending-aa-bb")).toBe("PENDING-AA-BB");
  });
});
