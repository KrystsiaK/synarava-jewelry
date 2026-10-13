import { describe, expect, it } from "vitest";
import {
  listPendingSkuReservations,
  readPendingSkuReservation,
  withPendingSkuReservation,
  withoutPendingSkuReservation,
} from "@/lib/sku/pending-reservation";

const pending = {
  reservationId: "res-1",
  sku: "JW-NECK-001",
  familyKey: "jewelry.necklace",
  correlationId: "corr-12345678",
  idempotencyKey: "idem-12345678",
  localVariantId: "var-1",
} as const;

const pendingB = {
  ...pending,
  reservationId: "res-2",
  sku: "JW-NECK-002",
  localVariantId: "var-2",
  idempotencyKey: "idem-2",
} as const;

describe("pending sku reservation details helpers", () => {
  it("round-trips through per-variant map", () => {
    const details = withPendingSkuReservation({ attributes: [] }, pending);
    expect(readPendingSkuReservation(details, "var-1")).toEqual(pending);
    expect(listPendingSkuReservations(details)).toEqual([pending]);
  });

  it("keeps two variant pendings independently", () => {
    const details = withPendingSkuReservation(
      withPendingSkuReservation({ attributes: [] }, pending),
      pendingB,
    );
    expect(listPendingSkuReservations(details)).toHaveLength(2);
    expect(readPendingSkuReservation(details, "var-2")).toEqual(pendingB);
    const cleared = withoutPendingSkuReservation(details, "var-1");
    expect(readPendingSkuReservation(cleared, "var-1")).toBeNull();
    expect(readPendingSkuReservation(cleared, "var-2")).toEqual(pendingB);
  });

  it("reads legacy single-slot shape", () => {
    expect(
      readPendingSkuReservation({
        skuAssignmentPending: {
          reservationId: "res-1",
          sku: "JW-NECK-001",
          familyKey: "jewelry.necklace",
          correlationId: "corr-12345678",
          idempotencyKey: "idem-12345678",
          localVariantId: "var-1",
        },
      }),
    ).toEqual(pending);
  });

  it("clears all when variantId omitted", () => {
    const details = withPendingSkuReservation({ attributes: [{ label: "A", value: "1" }] }, pending);
    expect(withoutPendingSkuReservation(details)).toEqual({
      attributes: [{ label: "A", value: "1" }],
    });
  });

  it("returns null when incomplete", () => {
    expect(readPendingSkuReservation({ skuAssignmentPending: { sku: "X" } })).toBeNull();
  });
});
