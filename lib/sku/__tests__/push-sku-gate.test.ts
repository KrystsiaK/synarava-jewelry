import { describe, expect, it, vi } from "vitest";
import type { SkuClient } from "@synarava/sku-contract";
import {
  assertSkuAssignableBeforePush,
  PUSH_SKU_CLIENT_MISSING_ERROR,
  PUSH_SKU_UNASSIGNED_ERROR,
  requireSkuClientForPendingConfirm,
} from "@/lib/sku/push-sku-gate";

const pending = {
  reservationId: "res-1",
  sku: "JW-NECK-001",
  familyKey: "jewelry.necklace",
  correlationId: "corr-aaaaaaaa",
  idempotencyKey: "idem-1",
  localVariantId: "var-1",
};

describe("push SKU gate (matrix M8 / M12)", () => {
  it("M8: blocks Push for PENDING-* without reservation when sku-api configured", () => {
    expect(() =>
      assertSkuAssignableBeforePush({
        skuApiConfigured: true,
        commerceSku: "PENDING-aa-bb",
        pendingReservation: null,
      }),
    ).toThrow(PUSH_SKU_UNASSIGNED_ERROR);
  });

  it("M8: push-unassigned copy points at Stock tab → Family → Preview → Confirm", () => {
    expect(PUSH_SKU_UNASSIGNED_ERROR).toBe(
      "SKU is not assigned. Use Stock tab → Family → Preview → Confirm assign before Push (sku-api).",
    );
  });

  it("M8: allows Push when pending reservation exists for PENDING commerce SKU", () => {
    expect(() =>
      assertSkuAssignableBeforePush({
        skuApiConfigured: true,
        commerceSku: "PENDING-aa-bb",
        pendingReservation: pending,
      }),
    ).not.toThrow();
  });

  it("M8: skips gate when sku-api is not configured", () => {
    expect(() =>
      assertSkuAssignableBeforePush({
        skuApiConfigured: false,
        commerceSku: "PENDING-aa-bb",
        pendingReservation: null,
      }),
    ).not.toThrow();
  });

  it("M12: requires sku-api client when confirming pending on Push", () => {
    expect(() => requireSkuClientForPendingConfirm(null)).toThrow(PUSH_SKU_CLIENT_MISSING_ERROR);
  });

  it("M12: returns the client when available", () => {
    const client = { reserve: vi.fn() } as unknown as SkuClient;
    expect(requireSkuClientForPendingConfirm(client)).toBe(client);
  });
});
