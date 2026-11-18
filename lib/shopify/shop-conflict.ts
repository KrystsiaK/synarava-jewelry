/**
 * SHOP ConflictResolver loader — SyncResult leaves for the free-shipping threshold.
 * Open uses skipRefresh; Apply/preview rechecks via shop scope.
 */

import "server-only";

import { FREE_SHIPPING_THRESHOLD_RESOURCE_ID } from "@/lib/content/announcement-bar-fields";
import { catalogConflictFieldsForEntity, runSyncWaterfall } from "@/lib/sync";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import type { CatalogConflictField } from "@/lib/shopify/catalog-conflict";

export type ShopCatalogConflict = {
  shopId: string;
  fields: CatalogConflictField[];
};

/**
 * ConflictResolver field list from SyncResult leaves (waterfall compare).
 * Opening the resolver must use `skipRefresh: true` — no Shopify fetch.
 */
export async function loadShopConflictFromSyncResult(
  shopId: string = FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
  options: { requestedBy: string; skipRefresh?: boolean },
): Promise<ShopCatalogConflict> {
  const [{ result }, locales] = await Promise.all([
    runSyncWaterfall({
      scope: { kind: "shop" },
      requestedBy: options.requestedBy,
      skipRefresh: options.skipRefresh ?? true,
    }),
    getPublishedStorefrontLocales(),
  ]);

  return {
    shopId,
    fields: catalogConflictFieldsForEntity(result, {
      resourceType: "SHOP",
      resourceId: shopId,
      locales: locales.map((locale) => ({
        code: locale.code,
        name: locale.name,
        nativeName: locale.nativeName,
      })),
    }),
  };
}

/** Shop resource ids with ≥1 open SyncResult leaf (skipRefresh). */
export async function listConflictedShopIds(requestedBy = "system"): Promise<string[]> {
  const { result } = await runSyncWaterfall({
    scope: { kind: "shop" },
    requestedBy,
    skipRefresh: true,
  });
  const ids = new Set<string>();
  for (const leaf of result.leaves) {
    if (leaf.resourceType === "SHOP") ids.add(leaf.resourceId);
  }
  return [...ids];
}
