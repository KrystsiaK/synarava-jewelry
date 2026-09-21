import "server-only";

import { listStorefrontLocales, type StorefrontLocaleRecord } from "./storefront-locale-registry";

const TTL_MS = 30_000;

// Routing runs on every request (proxy.ts) and must never block on a fresh
// DB round trip or fail the whole site if the DB hiccups. A bounded-TTL
// in-memory snapshot, refreshed lazily, keeps registry reads off the hot
// path without adding a separate cache infrastructure.
let cache: { locales: StorefrontLocaleRecord[]; expiresAt: number } | null = null;

/** All registered locales (published or not), from a bounded-TTL cache. */
export async function getStorefrontLocales(): Promise<StorefrontLocaleRecord[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.locales;

  try {
    const locales = await listStorefrontLocales();
    cache = { locales, expiresAt: now + TTL_MS };
    return locales;
  } catch (error) {
    // ponytail: serve the last-known-good snapshot on a transient DB error
    // rather than take routing down; a real outage self-heals once the DB
    // recovers and the next request's cache read succeeds.
    if (cache) return cache.locales;
    console.error("[storefront-locale-cache] registry read failed with no cached fallback", error);
    return [];
  }
}

/** Published locales only, ordered by sortOrder — what routing/SEO should ever expose. */
export async function getPublishedStorefrontLocales(): Promise<StorefrontLocaleRecord[]> {
  return (await getStorefrontLocales()).filter((locale) => locale.isPublished);
}

/** Call after any write that changes locale publication or route segments. */
export function invalidateStorefrontLocaleCache() {
  cache = null;
}
