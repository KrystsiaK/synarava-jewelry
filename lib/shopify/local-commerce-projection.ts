import { isDeepStrictEqual } from "node:util";

import {
  canonicalizeShopifyProjection,
  writeThroughLocalCommerceToProjection,
  type LocalCommerceProjectionPatch,
} from "@/lib/shopify/shopify-projection-diff";

/** True when view-column commerce already matches the projection (no write-through needed). */
export function localCommerceMatchesProjection(
  snapshot: unknown,
  patch: LocalCommerceProjectionPatch,
): boolean {
  const next = writeThroughLocalCommerceToProjection(snapshot, patch);
  return isDeepStrictEqual(
    canonicalizeShopifyProjection(snapshot ?? {}),
    canonicalizeShopifyProjection(next),
  );
}
