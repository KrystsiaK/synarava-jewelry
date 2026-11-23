/**
 * Bounded-TTL cache for Shopify `shopLocales` + shop domain — same shape as the
 * storefront locale registry snapshot (short TTL + explicit invalidation).
 */

import "server-only";

import {
  fetchShopifyLocales,
  fetchShopifyShopIdentity,
  type ShopifyShopLocale,
} from "@/lib/shopify/admin";

const TTL_MS = 30_000;

export type ShopifyShopLocalesSnapshot = {
  shopDomain: string;
  locales: ShopifyShopLocale[];
  /** Locale codes as returned by Shopify (casing preserved for messages). */
  localeCodes: string[];
};

let cache: { snapshot: ShopifyShopLocalesSnapshot; expiresAt: number } | null = null;

/** Enabled shop locales + domain from Admin API, cached briefly. */
export async function getShopifyShopLocalesSnapshot(): Promise<ShopifyShopLocalesSnapshot> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.snapshot;

  const [locales, shop] = await Promise.all([
    fetchShopifyLocales(),
    fetchShopifyShopIdentity(),
  ]);
  const snapshot: ShopifyShopLocalesSnapshot = {
    shopDomain: shop.myshopifyDomain,
    locales,
    localeCodes: locales.map((locale) => locale.locale),
  };
  cache = { snapshot, expiresAt: now + TTL_MS };
  return snapshot;
}

/** Enabled shop locales from Admin API (`shopLocales`), cached briefly. */
export async function getShopifyShopLocales(): Promise<ShopifyShopLocale[]> {
  return (await getShopifyShopLocalesSnapshot()).locales;
}

/** Case-insensitive set of Shopify locale codes currently enabled on the shop. */
export async function getEnabledShopifyLocaleCodes(): Promise<ReadonlySet<string>> {
  const snapshot = await getShopifyShopLocalesSnapshot();
  return new Set(snapshot.localeCodes.map((code) => code.toLowerCase()));
}

/** Call after shopLocaleEnable / Update / Disable, or when a Check Shopify refreshes Markets. */
export function invalidateShopifyShopLocalesCache() {
  cache = null;
}
