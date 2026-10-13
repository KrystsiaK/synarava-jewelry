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

function parsePending(value: unknown): PendingSkuReservation | null {
  const pending = asRecord(value);
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

function pendingMapKey(localVariantId: string | null): string {
  return localVariantId ?? "__primary__";
}

/** All pending reservations (legacy single + per-variant map). */
export function listPendingSkuReservations(details: unknown): PendingSkuReservation[] {
  const root = asRecord(details);
  const fromMap = asRecord(root.skuAssignmentPendings);
  const mapped = Object.values(fromMap).flatMap((value) => {
    const pending = parsePending(value);
    return pending ? [pending] : [];
  });
  if (mapped.length > 0) return mapped;
  const legacy = parsePending(root.skuAssignmentPending);
  return legacy ? [legacy] : [];
}

export function readPendingSkuReservation(
  details: unknown,
  variantId?: string | null,
): PendingSkuReservation | null {
  const all = listPendingSkuReservations(details);
  if (all.length === 0) return null;
  if (variantId) {
    return all.find((pending) => pending.localVariantId === variantId) ?? null;
  }
  return all[0] ?? null;
}

export function withPendingSkuReservation(
  details: unknown,
  pending: PendingSkuReservation,
): Record<string, unknown> {
  const root = asRecord(details);
  const key = pendingMapKey(pending.localVariantId);
  const nextMap = {
    ...asRecord(root.skuAssignmentPendings),
    [key]: {
      reservationId: pending.reservationId,
      sku: pending.sku,
      familyKey: pending.familyKey,
      correlationId: pending.correlationId,
      idempotencyKey: pending.idempotencyKey,
      localVariantId: pending.localVariantId,
    },
  };
  const next: Record<string, unknown> = { ...root, skuAssignmentPendings: nextMap };
  delete next.skuAssignmentPending;
  return next;
}

export function withoutPendingSkuReservation(
  details: unknown,
  variantId?: string | null,
): Record<string, unknown> {
  const root = asRecord(details);
  const next: Record<string, unknown> = { ...root };
  delete next.skuAssignmentPending;

  if (!variantId) {
    delete next.skuAssignmentPendings;
    return next;
  }

  const cleaned = Object.fromEntries(
    Object.entries(asRecord(root.skuAssignmentPendings)).filter(([key, value]) => {
      if (key === variantId || key === pendingMapKey(variantId)) return false;
      const pending = parsePending(value);
      return pending?.localVariantId !== variantId;
    }),
  );
  if (Object.keys(cleaned).length === 0) {
    delete next.skuAssignmentPendings;
  } else {
    next.skuAssignmentPendings = cleaned;
  }
  return next;
}
