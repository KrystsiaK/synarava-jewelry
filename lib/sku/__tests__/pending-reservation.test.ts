import { describe, expect, it } from "vitest";
import {
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

describe("pending sku reservation details helpers", () => {
  it("round-trips through details JSON", () => {
    const details = withPendingSkuReservation({ attributes: [] }, pending);
    expect(readPendingSkuReservation(details)).toEqual(pending);
  });

  it("clears pending without dropping sibling keys", () => {
    const details = withPendingSkuReservation({ attributes: [{ label: "A", value: "1" }] }, pending);
    expect(withoutPendingSkuReservation(details)).toEqual({
      attributes: [{ label: "A", value: "1" }],
    });
  });

  it("returns null when incomplete", () => {
    expect(readPendingSkuReservation({ skuAssignmentPending: { sku: "X" } })).toBeNull();
  });
});
