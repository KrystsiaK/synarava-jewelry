/** Entity noun for catalog conflict-check user copy (products | collections). */
export type ConflictCheckEntity = "product" | "collection";

export const CONFLICT_CHECK_ENTITY_NOUN = {
  product: { singular: "product", plural: "products" },
  collection: { singular: "collection", plural: "collections" },
} as const satisfies Record<ConflictCheckEntity, { singular: string; plural: string }>;

/**
 * Short success copy for conflict-check actions.
 * List UIs should not toast this — the banner already shows the result.
 * Kept for scoped editor refresh paths that still surface a single line.
 */
export function conflictCheckSuccessMessage(
  _entity: ConflictCheckEntity,
  _totalCount: number | null | undefined,
): string {
  return "Conflict check finished";
}

/** Drop internal / Markets / PR jargon from any conflict-check warning before it reaches the UI. */
export function publicConflictCheckWarning(warning: string | undefined): string | undefined {
  if (!warning?.trim()) return undefined;
  if (
    /sync-unification|awaits\s|PR\d+|#\d+|Shopify Markets|translation sync will be skipped|not enabled\/published/i.test(
      warning,
    )
  ) {
    return undefined;
  }
  return warning.trim();
}
