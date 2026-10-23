import "server-only";

import { applyCatalogPresenceDifference } from "@/lib/shopify/catalog-presence-server";
import { applyCollectionPresenceDifference } from "@/lib/shopify/collection-presence-server";
import type { CatalogPresenceDifference } from "@/lib/shopify/catalog-presence";
import type { CollectionPresenceDifference } from "@/lib/shopify/collection-presence";

/** Human-only presence Apply — product or collection by resource type. */
export async function applyPresenceSync(
  input:
    | {
        resourceType: "PRODUCT";
        difference: CatalogPresenceDifference;
        direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
      }
    | {
        resourceType: "COLLECTION";
        difference: CollectionPresenceDifference;
        direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
      },
) {
  if (input.resourceType === "COLLECTION") {
    return applyCollectionPresenceDifference({
      difference: input.difference,
      direction: input.direction,
    });
  }
  return applyCatalogPresenceDifference({
    difference: input.difference,
    direction: input.direction,
  });
}
