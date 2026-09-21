import { db } from "@/lib/db";

import { fetchShopifyLocales, type ShopifyShopLocale } from "./admin";

export type StorefrontLocaleSyncResult = {
  /** Registry rows whose `isPublished`/`shopifyUpdatedAt` were refreshed. `routeSegment`, `code`, and `shopifyLocale` are never touched. */
  updated: Array<{ code: string; shopifyLocale: string; isPublished: boolean }>;
  /** Shopify locales with no matching registry row — enabling them needs an operator to pick a `routeSegment` first. */
  unmatched: ShopifyShopLocale[];
  /** Registry rows whose `shopifyLocale` Shopify no longer reports at all; treated as unpublished until reconciled. */
  orphaned: Array<{ code: string; shopifyLocale: string }>;
};

/**
 * Pulls `shopLocales` from Shopify and refreshes each matching registry
 * row's publication state. Never creates rows (a new language needs a
 * human-chosen `routeSegment`) and never overwrites `routeSegment`.
 */
export async function syncStorefrontLocalesFromShopify(): Promise<StorefrontLocaleSyncResult> {
  const [shopifyLocales, registryRows] = await Promise.all([
    fetchShopifyLocales(),
    db.storefrontLocale.findMany(),
  ]);

  const shopifyByLocale = new Map(shopifyLocales.map((entry) => [entry.locale.toLowerCase(), entry]));
  const updated: StorefrontLocaleSyncResult["updated"] = [];
  const orphaned: StorefrontLocaleSyncResult["orphaned"] = [];

  for (const row of registryRows) {
    const match = shopifyByLocale.get(row.shopifyLocale.toLowerCase());
    const isPublished = match?.published ?? false;

    await db.storefrontLocale.update({
      where: { id: row.id },
      data: { isPublished, shopifyUpdatedAt: new Date() },
    });
    updated.push({ code: row.code, shopifyLocale: row.shopifyLocale, isPublished });

    if (!match) orphaned.push({ code: row.code, shopifyLocale: row.shopifyLocale });
  }

  const registeredShopifyLocales = new Set(registryRows.map((row) => row.shopifyLocale.toLowerCase()));
  const unmatched = shopifyLocales.filter((entry) => !registeredShopifyLocales.has(entry.locale.toLowerCase()));

  return { updated, unmatched, orphaned };
}
