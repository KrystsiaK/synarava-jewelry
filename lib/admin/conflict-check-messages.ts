/** Entity noun for catalog conflict-check user copy (products | collections). */
export type ConflictCheckEntity = "product" | "collection";

export const CONFLICT_CHECK_ENTITY_NOUN = {
  product: { singular: "product", plural: "products" },
  collection: { singular: "collection", plural: "collections" },
} as const satisfies Record<ConflictCheckEntity, { singular: string; plural: string }>;
