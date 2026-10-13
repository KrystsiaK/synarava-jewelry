/**
 * Automated coverage for staging matrix rows M3, M4, M5, M7, M8, M12.
 * Isolated fixtures only — does not touch live staging products.
 */
import { describe, expect, it, vi } from "vitest";
import type { SkuClient } from "@synarava/sku-contract";
import {
  assignVariantSku,
  confirmPendingSkuAfterShopifyWrite,
  resumePendingSkuAssignment,
} from "@/lib/sku/assign-variant-sku";
import {
  assertSkuAssignableBeforePush,
  PUSH_SKU_CLIENT_MISSING_ERROR,
  PUSH_SKU_UNASSIGNED_ERROR,
  requireSkuClientForPendingConfirm,
} from "@/lib/sku/push-sku-gate";

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
      idempotencyKey: "sku-assign:p1:var-1:jewelry.necklace",
      localVariantId: "var-1",
    },
  },
};

describe("staging matrix automation (M3–M5, M7, M8, M12)", () => {
  it("M3: Retry confirm / resume does not create a second reserve", async () => {
    const client = mockClient();
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });
    const readShopifySku = vi.fn().mockResolvedValue({ ok: true, sku: "JW-NECK-001" });

    const viaResume = await resumePendingSkuAssignment(
      { productId: "p1", variantId: "var-1" },
      {
        client,
        externalShop: "fixture.myshopify.com",
        readShopifySku,
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "JW-NECK-001",
          details: pendingDetails,
          shopifyProductId: "gid://shopify/Product/fixture-1",
          variants: [{
            id: "var-1",
            sku: "JW-NECK-001",
            shopifyVariantId: "gid://shopify/ProductVariant/fixture-1",
          }],
        }),
      },
    );

    const viaAssign = await assignVariantSku(
      { productId: "p1", familyKey: "jewelry.necklace", variantId: "var-1" },
      {
        client,
        externalShop: "fixture.myshopify.com",
        readShopifySku,
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "JW-NECK-001",
          details: pendingDetails,
          shopifyProductId: "gid://shopify/Product/fixture-1",
          variants: [{
            id: "var-1",
            sku: "JW-NECK-001",
            shopifyVariantId: "gid://shopify/ProductVariant/fixture-1",
          }],
        }),
      },
    );

    expect(viaResume.ok).toBe(true);
    expect(viaAssign.ok).toBe(true);
    if (viaResume.ok) expect(viaResume.resumed).toBe(true);
    if (viaAssign.ok) expect(viaAssign.resumed).toBe(true);
    expect(client.reserve).not.toHaveBeenCalled();
    expect(client.confirmAssignment).toHaveBeenCalledTimes(2);
  });

  it("M4: second Confirm assign after success is blocked (no second sequence)", async () => {
    const client = mockClient();
    const result = await assignVariantSku(
      { productId: "p1", familyKey: "jewelry.necklace", variantId: "var-1" },
      {
        client,
        externalShop: "fixture.myshopify.com",
        persistLocalSku: vi.fn(),
        loadProduct: async () => ({
          id: "p1",
          sku: "JW-NECK-001",
          details: {},
          shopifyProductId: "gid://shopify/Product/fixture-1",
          variants: [{
            id: "var-1",
            sku: "JW-NECK-001",
            shopifyVariantId: "gid://shopify/ProductVariant/fixture-1",
          }],
        }),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/already has SKU/i);
    }
    expect(client.reserve).not.toHaveBeenCalled();
  });

  it("M5: parallel Confirm with same idempotency key yields one SKU", async () => {
    const reservationsByKey = new Map<string, { reservationId: string; sku: string; sequence: number }>();
    let nextSequence = 1;
    const reserve = vi.fn(
      async (
        _body: { familyKey: string; correlationId: string },
        idempotencyKey: string,
      ) => {
        const existing = reservationsByKey.get(idempotencyKey);
        if (existing) {
          return {
            ok: true as const,
            value: {
              ok: true as const,
              reservationId: existing.reservationId,
              sku: existing.sku,
              stem: "JW-NECK",
              sequence: existing.sequence,
              policyVersion: 1,
              familyKey: "jewelry.necklace",
              status: "pending" as const,
              correlationId: "corr-shared",
            },
          };
        }
        const created = {
          reservationId: `res-${nextSequence}`,
          sku: `JW-NECK-${String(nextSequence).padStart(3, "0")}`,
          sequence: nextSequence,
        };
        nextSequence += 1;
        reservationsByKey.set(idempotencyKey, created);
        return {
          ok: true as const,
          value: {
            ok: true as const,
            reservationId: created.reservationId,
            sku: created.sku,
            stem: "JW-NECK",
            sequence: created.sequence,
            policyVersion: 1,
            familyKey: "jewelry.necklace",
            status: "pending" as const,
            correlationId: "corr-shared",
          },
        };
      },
    );
    const client = mockClient({ reserve: reserve as SkuClient["reserve"] });
    const writeShopifySku = vi.fn().mockResolvedValue({ ok: true, readBackSku: "JW-NECK-001" });
    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });
    const loadProduct = async () => ({
      id: "p1",
      sku: "PENDING-fixture-a",
      details: {},
      shopifyProductId: "gid://shopify/Product/fixture-1",
      variants: [{
        id: "var-1",
        sku: "PENDING-fixture-a",
        shopifyVariantId: "gid://shopify/ProductVariant/fixture-1",
      }],
    });

    const [a, b] = await Promise.all([
      assignVariantSku(
        { productId: "p1", familyKey: "jewelry.necklace", variantId: "var-1" },
        { client, externalShop: "fixture.myshopify.com", writeShopifySku, persistLocalSku, loadProduct },
      ),
      assignVariantSku(
        { productId: "p1", familyKey: "jewelry.necklace", variantId: "var-1" },
        { client, externalShop: "fixture.myshopify.com", writeShopifySku, persistLocalSku, loadProduct },
      ),
    ]);

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.sku).toBe(b.sku);
    expect(a.sku).toBe("JW-NECK-001");
    expect(reserve).toHaveBeenCalled();
    const keys = reserve.mock.calls.map((call) => call[1]);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("sku-assign:p1:var-1:jewelry.necklace");
  });

  it("M7: parallel assign on two variants (same family) gets distinct SKUs", async () => {
    let nextSequence = 1;
    const reserve = vi.fn(
      async (
        _body: { familyKey: string; correlationId: string },
        idempotencyKey: string,
      ) => {
        const sequence = nextSequence;
        nextSequence += 1;
        return {
          ok: true as const,
          value: {
            ok: true as const,
            reservationId: `res-${sequence}`,
            sku: `JW-NECK-${String(sequence).padStart(3, "0")}`,
            stem: "JW-NECK",
            sequence,
            policyVersion: 1,
            familyKey: "jewelry.necklace",
            status: "pending" as const,
            correlationId: `corr-${sequence}`,
            idempotencyKey,
          },
        };
      },
    );
    const client = mockClient({ reserve: reserve as SkuClient["reserve"] });
    const writeShopifySku = vi.fn(async (input: { shopifyVariantId: string; sku: string }) => ({
      ok: true as const,
      readBackSku: input.sku,
    }));
    const persistLocalSku = vi.fn(async (input: { variantId: string | null }) => ({
      variantId: input.variantId ?? "unknown",
    }));
    const loadProduct = async () => ({
      id: "p-multi",
      sku: "PENDING-prim-ary",
      details: {},
      shopifyProductId: "gid://shopify/Product/fixture-multi",
      variants: [
        {
          id: "var-a",
          sku: "PENDING-var-a",
          shopifyVariantId: "gid://shopify/ProductVariant/a",
        },
        {
          id: "var-b",
          sku: "PENDING-var-b",
          shopifyVariantId: "gid://shopify/ProductVariant/b",
        },
      ],
    });

    const [a, b] = await Promise.all([
      assignVariantSku(
        { productId: "p-multi", familyKey: "jewelry.necklace", variantId: "var-a" },
        { client, externalShop: "fixture.myshopify.com", writeShopifySku, persistLocalSku, loadProduct },
      ),
      assignVariantSku(
        { productId: "p-multi", familyKey: "jewelry.necklace", variantId: "var-b" },
        { client, externalShop: "fixture.myshopify.com", writeShopifySku, persistLocalSku, loadProduct },
      ),
    ]);

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.sku).not.toBe(b.sku);
    const keys = reserve.mock.calls.map((call) => call[1]).sort();
    expect(keys).toEqual([
      "sku-assign:p-multi:var-a:jewelry.necklace",
      "sku-assign:p-multi:var-b:jewelry.necklace",
    ]);
  });

  it("M8: PENDING-* without reservation blocks Push", () => {
    expect(() =>
      assertSkuAssignableBeforePush({
        skuApiConfigured: true,
        commerceSku: "PENDING-aa-bb",
        pendingReservation: null,
      }),
    ).toThrow(/SKU is not assigned/);
    expect(PUSH_SKU_UNASSIGNED_ERROR).toMatch(/SKU is not assigned/);
  });

  it("M12: sku-api unavailable keeps pending and surfaces clear error", async () => {
    expect(() => requireSkuClientForPendingConfirm(null)).toThrow(/sku-api is not configured/);
    expect(PUSH_SKU_CLIENT_MISSING_ERROR).toMatch(/sku-api is not configured/);

    const persistLocalSku = vi.fn().mockResolvedValue({ variantId: "var-1" });
    const client = mockClient({
      confirmAssignment: vi.fn().mockResolvedValue({
        ok: false,
        error: { message: "fetch failed: sku-api unavailable" },
      }),
    });

    const result = await confirmPendingSkuAfterShopifyWrite(
      {
        productId: "p1",
        shopifyProductId: "gid://shopify/Product/fixture-1",
        shopifyVariantId: "gid://shopify/ProductVariant/fixture-1",
        shopifyReadBackSku: "JW-NECK-001",
        localVariantId: "var-1",
      },
      {
        client,
        externalShop: "fixture.myshopify.com",
        persistLocalSku,
        loadProduct: async () => ({
          id: "p1",
          sku: "JW-NECK-001",
          details: pendingDetails,
          shopifyProductId: "gid://shopify/Product/fixture-1",
          variants: [{
            id: "var-1",
            sku: "JW-NECK-001",
            shopifyVariantId: "gid://shopify/ProductVariant/fixture-1",
          }],
        }),
      },
    );

    expect(result).toEqual({
      ok: false,
      error: "fetch failed: sku-api unavailable",
    });
    expect(persistLocalSku).not.toHaveBeenCalled();
  });
});
