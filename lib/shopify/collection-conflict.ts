import "server-only";

import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import {
  catalogConflictFieldsForEntity,
  runSyncWaterfall,
} from "@/lib/sync";

import type { CatalogConflictField } from "./catalog-conflict";
import { getLatestCollectionPresenceDifferences } from "./collection-presence-server";

export type CollectionCatalogConflict = {
  collectionId: string;
  fields: CatalogConflictField[];
};

/**
 * ConflictResolver field list from SyncResult leaves (waterfall compare).
 * Opening the resolver must use `skipRefresh: true` — no Shopify fetch.
 */
export async function loadCollectionConflictFromSyncResult(
  collectionId: string,
  options: { requestedBy: string; skipRefresh?: boolean },
): Promise<CollectionCatalogConflict> {
  const [{ result }, locales, presenceDifferences] = await Promise.all([
    runSyncWaterfall({
      scope: { kind: "collection", collectionId },
      requestedBy: options.requestedBy,
      skipRefresh: options.skipRefresh ?? true,
    }),
    getPublishedStorefrontLocales(),
    getLatestCollectionPresenceDifferences(),
  ]);

  const presence = presenceDifferences.find((difference) => difference.id === collectionId);
  const fields = catalogConflictFieldsForEntity(result, {
    resourceType: "COLLECTION",
    resourceId: collectionId,
    locales: locales.map((locale) => ({
      code: locale.code,
      name: locale.name,
      nativeName: locale.nativeName,
    })),
    presenceDifference: presence ?? null,
  });

  return { collectionId, fields };
}

/** Collection IDs with ≥1 open SyncResult leaf — not `syncStatus: CONFLICT`. */
export async function listConflictedCollectionIds(requestedBy = "system"): Promise<string[]> {
  const { result } = await runSyncWaterfall({
    scope: { kind: "collections" },
    requestedBy,
    skipRefresh: true,
  });
  const collectionIds = new Set<string>();
  for (const leaf of result.leaves) {
    if (leaf.resourceType === "COLLECTION") collectionIds.add(leaf.resourceId);
  }
  return [...collectionIds];
}
