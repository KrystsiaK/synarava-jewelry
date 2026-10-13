/**
 * M2 regression: Pull empty Shopify SKU must stay assignable through linked
 * reserve → write → read-back → confirm (no synthetic SHOPIFY-* lock).
 */
import { describe, expect, it, vi } from "vitest";
import type { SkuClient } from "@synarava/sku-contract";
import { assignVariantSku } from "@/lib/sku/assign-variant-sku";
import {
  isPendingCommerceSku,
  localSkuForEmptyShopifySku,
} from "@/lib/sku/pending-sku";

function mockClient(): SkuClient {
  return {
    preview: vi.fn(),
    reserve: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ok: true,
        reservationId: "res-m2",
        sku: "JW-NECK-042",
        stem: "JW-NECK",
        sequence: 42,
        policyVersion: 1,
        familyKey: "jewelry.necklace",
        status: "pending",
        correlationId: "corr-m2",
      },
    }),
    confirmAssignment: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ok: true,
        assignmentId: "asg-m2",
        sku: "JW-NECK-042",
        policyVersion: 1,
        status: "active",
        correlationId: "corr-m2",
      },
    }),
    validate: vi.fn(),
    listProfiles: vi.fn(),
    listAssignments: vi.fn(),
    listAuditEvents: vi.fn(),
    saveDraftProfile: vi.fn(),
    publishProfile: vi.fn(),
  } as unknown as SkuClient;
}

describe("M2 linked flow after Pull empty Shopify SKU", () => {
  it("invent from empty remote SKU is pending/assignable (not SHOPIFY-* lock)", () => {
    const local = localSkuForEmptyShopifySku({
      shopifyProductId: "gid://shopify/Product/9001",
      shopifyVariantId: "gid://shopify/ProductVariant/9002",
    });
    expect(local).toBe("PENDING-p9001-v9002");
    expect(isPendingCommerceSku(local)).toBe(true);
    expect(local.startsWith("SHOPIFY-")).toBe(false);
  });

  it("classifies Kiryl staging invent string as needing assignment", () => {
    const kiryl = "SHOPIFY-16079211397451-58824796668235";
    expect(isPendingCommerceSku(kiryl)).toBe(true);
  });

  it("legacy SHOPIFY-* invent still allows Confirm assign (already-pulled products)", async () => {
    const client = mockClient();
    const writeShopifySku = vi.fn().mockResolvedValue({ ok: true, readBackSku: "JW-NECK-042" });
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });

    const result = await assignVariantSku(
      { productId: "p-m2-legacy", familyKey: "jewelry.necklace", variantId: "var-1" },
      {
        client,
        externalShop: "fixture.myshopify.com",
        writeShopifySku,
        persistLocalSku,
        loadProduct: async () => ({
          id: "p-m2-legacy",
          sku: "SHOPIFY-9001",
          details: {},
          shopifyProductId: "gid://shopify/Product/9001",
          variants: [{
            id: "var-1",
            sku: "SHOPIFY-9001",
            shopifyVariantId: "gid://shopify/ProductVariant/9002",
          }],
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.confirmed).toBe(true);
    expect(result.sku).toBe("JW-NECK-042");
    expect(client.reserve).toHaveBeenCalledOnce();
    expect(writeShopifySku).toHaveBeenCalledWith(
      expect.objectContaining({
        shopifyProductId: "gid://shopify/Product/9001",
        shopifyVariantId: "gid://shopify/ProductVariant/9002",
        sku: "JW-NECK-042",
      }),
    );
    expect(client.confirmAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ shopifyReadBackSku: "JW-NECK-042" }),
    );
  });

  it("full linked flow: Pull-empty PENDING invent → reserve → write → read-back → confirm", async () => {
    const client = mockClient();
    const writeShopifySku = vi.fn().mockResolvedValue({ ok: true, readBackSku: "JW-NECK-042" });
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });
    const pulledSku = localSkuForEmptyShopifySku({
      shopifyProductId: "gid://shopify/Product/9001",
      shopifyVariantId: "gid://shopify/ProductVariant/9002",
    });

    const result = await assignVariantSku(
      { productId: "p-m2", familyKey: "jewelry.necklace", variantId: "var-1" },
      {
        client,
        externalShop: "fixture.myshopify.com",
        writeShopifySku,
        persistLocalSku,
        loadProduct: async () => ({
          id: "p-m2",
          sku: pulledSku,
          details: {},
          shopifyProductId: "gid://shopify/Product/9001",
          variants: [{
            id: "var-1",
            sku: pulledSku,
            shopifyVariantId: "gid://shopify/ProductVariant/9002",
          }],
        }),
      },
    );

    expect(isPendingCommerceSku(pulledSku)).toBe(true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.confirmed).toBe(true);
    expect(result.sku).toBe("JW-NECK-042");
    expect(result.assignmentId).toBe("asg-m2");
    expect(client.reserve).toHaveBeenCalledOnce();
    expect(writeShopifySku).toHaveBeenCalledOnce();
    expect(client.confirmAssignment).toHaveBeenCalledOnce();
    expect(persistLocalSku).toHaveBeenCalledWith(
      expect.objectContaining({ sku: "JW-NECK-042", variantId: "var-1" }),
    );
  });
});
