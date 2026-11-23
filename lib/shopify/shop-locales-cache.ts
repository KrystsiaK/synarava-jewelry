/**
 * Bounded-TTL cache for Shopify `shopLocales` — same shape as the storefront
 * locale registry snapshot (short TTL + explicit invalidation).
 */

import "server-only";

import { fetchShopifyLocales, type ShopifyShopLocale } from "@/lib/shopify/admin";

const TTL_MS = 30_000;

let cache: { locales: ShopifyShopLocale[]; expiresAt: number } | null = null;

/** Enabled shop locales from Admin API (`shopLocales`), cached briefly. */
export async function getShopifyShopLocales(): Promise<ShopifyShopLocale[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.locales;

  const locales = await fetchShopifyLocales();
  cache = { locales, expiresAt: now + TTL_MS };
  return locales;
}

/** Case-insensitive set of Shopify locale codes currently enabled on the shop. */
export async function getEnabledShopifyLocaleCodes(): Promise<ReadonlySet<string>> {
  const locales = await getShopifyShopLocales();
  return new Set(locales.map((locale) => locale.locale.toLowerCase()));
}

/** Call after shopLocaleEnable / Update / Disable, or when a Check Shopify refreshes Markets. */
export function invalidateShopifyShopLocalesCache() {
  cache = null;
}
