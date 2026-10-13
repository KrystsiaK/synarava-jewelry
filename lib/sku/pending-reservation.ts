export type PendingSkuReservation = {
  readonly reservationId: string;
  readonly sku: string;
  readonly familyKey: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly localVariantId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readPendingSkuReservation(details: unknown): PendingSkuReservation | null {
  const pending = asRecord(asRecord(details).skuAssignmentPending);
  const reservationId = typeof pending.reservationId === "string" ? pending.reservationId : "";
  const sku = typeof pending.sku === "string" ? pending.sku : "";
  const familyKey = typeof pending.familyKey === "string" ? pending.familyKey : "";
  const correlationId = typeof pending.correlationId === "string" ? pending.correlationId : "";
  const idempotencyKey = typeof pending.idempotencyKey === "string" ? pending.idempotencyKey : "";
  if (!reservationId || !sku || !familyKey || !correlationId || !idempotencyKey) {
    return null;
  }
  return {
    reservationId,
    sku,
    familyKey,
    correlationId,
    idempotencyKey,
    localVariantId: typeof pending.localVariantId === "string" ? pending.localVariantId : null,
  };
}

export function withPendingSkuReservation(
  details: unknown,
  pending: PendingSkuReservation,
): Record<string, unknown> {
  return {
    ...asRecord(details),
    skuAssignmentPending: {
      reservationId: pending.reservationId,
      sku: pending.sku,
      familyKey: pending.familyKey,
      correlationId: pending.correlationId,
      idempotencyKey: pending.idempotencyKey,
      localVariantId: pending.localVariantId,
    },
  };
}

export function withoutPendingSkuReservation(details: unknown): Record<string, unknown> {
  const next = { ...asRecord(details) };
  delete next.skuAssignmentPending;
  return next;
}
