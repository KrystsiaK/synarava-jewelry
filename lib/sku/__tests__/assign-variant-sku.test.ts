import { describe, expect, it, vi } from "vitest";
import {
  assignVariantSku,
  confirmPendingSkuAfterShopifyWrite,
  resumePendingSkuAssignment,
} from "@/lib/sku/assign-variant-sku";
import type { SkuClient } from "@synarava/sku-contract";

function mockClient(overrides: Partial<SkuClient> = {}): SkuClient {
  return {
    preview: vi.fn(),
    reserve: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ok: true,
        reservationId: "res-1",
        sku: "JW-NECK-001",
        stem: "JW-NECK",
        sequence: 1,
        policyVersion: 1,
        familyKey: "jewelry.necklace",
        status: "pending",
        correlationId: "corr-aaaaaaaa",
      },
    }),
    confirmAssignment: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ok: true,
        assignmentId: "asg-1",
        sku: "JW-NECK-001",
        policyVersion: 1,
        status: "active",
        correlationId: "corr-aaaaaaaa",
      },
    }),
    validate: vi.fn(),
    listProfiles: vi.fn(),
    listAssignments: vi.fn(),
    listAuditEvents: vi.fn(),
    saveDraftProfile: vi.fn(),
    publishProfile: vi.fn(),
    ...overrides,
  } as unknown as SkuClient;
}

const pendingDetails = {
  skuAssignmentPendings: {
    "var-1": {
      reservationId: "res-1",
      sku: "JW-NECK-001",
      familyKey: "jewelry.necklace",
      correlationId: "corr-aaaaaaaa",
      idempotencyKey: "idem-1",
      localVariantId: "var-1",
    },
  },
};

describe("assignVariantSku", () => {
  it("confirms when Shopify product + variant are linked", async () => {
    const client = mockClient();
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });
    const writeShopifySku = vi.fn().mockResolvedValue({ ok: true, readBackSku: "JW-NECK-001" });

    const result = await assignVariantSku(
      { productId: "p1", familyKey: "jewelry.necklace", correlationId: "corr-aaaaaaaa" },
      {
        client,
        externalShop: "synarava.myshopify.com",
        writeShopifySku,
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "PENDING-aa-bb",
          details: {},
          shopifyProductId: "gid://shopify/Product/1",
          variants: [{ id: "var-1", sku: "PENDING-aa-bb", shopifyVariantId: "gid://shopify/ProductVariant/9" }],
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.confirmed).toBe(true);
    expect(result.sku).toBe("JW-NECK-001");
    expect(writeShopifySku).toHaveBeenCalledOnce();
    expect(client.confirmAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        shopifyReadBackSku: "JW-NECK-001",
        externalProductId: "gid://shopify/Product/1",
        externalVariantId: "gid://shopify/ProductVariant/9",
      }),
    );
  });

  it("stores pending reservation when product is not linked to Shopify", async () => {
    const client = mockClient();
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });

    const result = await assignVariantSku(
      { productId: "p1", familyKey: "jewelry.necklace", correlationId: "corr-aaaaaaaa" },
      {
        client,
        externalShop: "synarava.myshopify.com",
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "PENDING-aa-bb",
          details: { attributes: [] },
          shopifyProductId: null,
          variants: [{ id: "var-1", sku: "PENDING-aa-bb", shopifyVariantId: null }],
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.confirmed).toBe(false);
    expect(client.confirmAssignment).not.toHaveBeenCalled();
    expect(persistLocalSku).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: "JW-NECK-001",
        details: expect.objectContaining({
          skuAssignmentPendings: expect.objectContaining({
            "var-1": expect.objectContaining({
              reservationId: "res-1",
              sku: "JW-NECK-001",
            }),
          }),
        }),
      }),
    );
  });

  it("refuses a second reservation when SKU is already assigned", async () => {
    const client = mockClient();
    const result = await assignVariantSku(
      { productId: "p1", familyKey: "jewelry.necklace" },
      {
        client,
        externalShop: "synarava.myshopify.com",
        persistLocalSku: vi.fn(),
        loadProduct: async () => ({
          id: "p1",
          sku: "JW-NECK-001",
          details: {},
          shopifyProductId: "gid://shopify/Product/1",
          variants: [{ id: "var-1", sku: "JW-NECK-001", shopifyVariantId: "gid://shopify/ProductVariant/9" }],
        }),
      },
    );
    expect(result.ok).toBe(false);
    expect(client.reserve).not.toHaveBeenCalled();
  });

  it("keeps pending when Shopify write fails on linked assign", async () => {
    const client = mockClient();
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });

    const result = await assignVariantSku(
      { productId: "p1", familyKey: "jewelry.necklace" },
      {
        client,
        externalShop: "synarava.myshopify.com",
        writeShopifySku: async () => ({ ok: false, error: "read-back mismatch" }),
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "PENDING-aa-bb",
          details: {},
          shopifyProductId: "gid://shopify/Product/1",
          variants: [{ id: "var-1", sku: "PENDING-aa-bb", shopifyVariantId: "gid://shopify/ProductVariant/9" }],
        }),
      },
    );

    expect(result.ok).toBe(false);
    expect(client.confirmAssignment).not.toHaveBeenCalled();
    expect(persistLocalSku).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ skuAssignmentPendings: expect.anything() }),
      }),
    );
  });

  it("resumes pending instead of reserving again (idempotent retry)", async () => {
    const client = mockClient();
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });
    const readShopifySku = vi.fn().mockResolvedValue({ ok: true, sku: "JW-NECK-001" });

    const result = await assignVariantSku(
      { productId: "p1", familyKey: "jewelry.necklace", variantId: "var-1" },
      {
        client,
        externalShop: "synarava.myshopify.com",
        readShopifySku,
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "JW-NECK-001",
          details: pendingDetails,
          shopifyProductId: "gid://shopify/Product/1",
          variants: [{ id: "var-1", sku: "JW-NECK-001", shopifyVariantId: "gid://shopify/ProductVariant/9" }],
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resumed).toBe(true);
    expect(result.confirmed).toBe(true);
    expect(client.reserve).not.toHaveBeenCalled();
    expect(client.confirmAssignment).toHaveBeenCalledOnce();
  });

  it("assigns a non-primary variant by variantId", async () => {
    const client = mockClient();
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-2" });
    const writeShopifySku = vi.fn().mockResolvedValue({ ok: true, readBackSku: "JW-NECK-001" });

    const result = await assignVariantSku(
      { productId: "p1", familyKey: "jewelry.necklace", variantId: "var-2" },
      {
        client,
        externalShop: "synarava.myshopify.com",
        writeShopifySku,
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "JW-NECK-000",
          details: {},
          shopifyProductId: "gid://shopify/Product/1",
          variants: [
            { id: "var-1", sku: "JW-NECK-000", shopifyVariantId: "gid://shopify/ProductVariant/1" },
            { id: "var-2", sku: "PENDING-xx-yy", shopifyVariantId: "gid://shopify/ProductVariant/2" },
          ],
        }),
      },
    );

    expect(result.ok).toBe(true);
    expect(writeShopifySku).toHaveBeenCalledWith(
      expect.objectContaining({ shopifyVariantId: "gid://shopify/ProductVariant/2" }),
    );
    expect(persistLocalSku).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: "var-2", sku: "JW-NECK-001" }),
    );
  });
});

describe("resumePendingSkuAssignment", () => {
  it("writes then confirms when Shopify SKU differs from pending", async () => {
    const client = mockClient();
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });
    const writeShopifySku = vi.fn().mockResolvedValue({ ok: true, readBackSku: "JW-NECK-001" });
    const readShopifySku = vi.fn().mockResolvedValue({ ok: true, sku: "" });

    const result = await resumePendingSkuAssignment(
      { productId: "p1", variantId: "var-1" },
      {
        client,
        externalShop: "synarava.myshopify.com",
        readShopifySku,
        writeShopifySku,
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "JW-NECK-001",
          details: pendingDetails,
          shopifyProductId: "gid://shopify/Product/1",
          variants: [{ id: "var-1", sku: "JW-NECK-001", shopifyVariantId: "gid://shopify/ProductVariant/9" }],
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(writeShopifySku).toHaveBeenCalledOnce();
    expect(client.confirmAssignment).toHaveBeenCalledOnce();
    expect(result.resumed).toBe(true);
  });
});

describe("confirmPendingSkuAfterShopifyWrite", () => {
  it("confirms matching pending reservation and clears details", async () => {
    const client = mockClient();
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });

    const result = await confirmPendingSkuAfterShopifyWrite(
      {
        productId: "p1",
        shopifyProductId: "gid://shopify/Product/1",
        shopifyVariantId: "gid://shopify/ProductVariant/9",
        shopifyReadBackSku: "JW-NECK-001",
        localVariantId: "var-1",
      },
      {
        client,
        externalShop: "synarava.myshopify.com",
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "JW-NECK-001",
          details: pendingDetails,
          shopifyProductId: "gid://shopify/Product/1",
          variants: [{ id: "var-1", sku: "JW-NECK-001", shopifyVariantId: "gid://shopify/ProductVariant/9" }],
        }),
      },
    );

    expect(result).toEqual({ ok: true, assignmentId: "asg-1" });
    expect(persistLocalSku).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.not.objectContaining({
          skuAssignmentPendings: expect.anything(),
          skuAssignmentPending: expect.anything(),
        }),
      }),
    );
  });

  it("still confirms legacy single-slot pending", async () => {
    const client = mockClient();
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });

    const result = await confirmPendingSkuAfterShopifyWrite(
      {
        productId: "p1",
        shopifyProductId: "gid://shopify/Product/1",
        shopifyVariantId: "gid://shopify/ProductVariant/9",
        shopifyReadBackSku: "JW-NECK-001",
      },
      {
        client,
        externalShop: "synarava.myshopify.com",
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "JW-NECK-001",
          details: {
            skuAssignmentPending: pendingDetails.skuAssignmentPendings["var-1"],
          },
          shopifyProductId: "gid://shopify/Product/1",
          variants: [{ id: "var-1", sku: "JW-NECK-001", shopifyVariantId: "gid://shopify/ProductVariant/9" }],
        }),
      },
    );

    expect(result).toEqual({ ok: true, assignmentId: "asg-1" });
  });
});
