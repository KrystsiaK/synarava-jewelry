import type { ShopFilters } from "@/lib/content/catalog";
import {
  decodeBase64UrlJsonCursor,
  encodeBase64UrlJsonCursor,
} from "@/lib/cursor/base64url-json-cursor";
import type { Locale } from "@/lib/i18n/locales";

export const CATALOG_DEFAULT_PAGE_SIZE = 24;
export const CATALOG_MAX_PAGE_SIZE = 48;

// ponytail: the loader resorts every filtered row on each request rather
// than keeping a persisted rank/price column, so it caps how many rows it
// will hold in memory for one request. Fine at this catalog's boutique
// scale; if the public catalog ever grows past this, denormalize listing
// price + best-selling rank onto Product instead of resorting per request.
export const CATALOG_CANDIDATE_CAP = 1000;

export function clampPageSize(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return CATALOG_DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(parsed), CATALOG_MAX_PAGE_SIZE);
}

/** Stable string identifying one locale + filter/sort combination. */
function fingerprint(filters: ShopFilters, locale: Locale): string {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return `${locale}|${JSON.stringify(entries)}`;
}

export function encodeCatalogCursor(filters: ShopFilters, locale: Locale, lastId: string): string {
  return encodeBase64UrlJsonCursor({ fp: fingerprint(filters, locale), id: lastId });
}

/** Returns the last-seen product id, or null if the cursor is missing, malformed, or was minted for a different query. */
export function decodeCatalogCursor(
  raw: string | null | undefined,
  filters: ShopFilters,
  locale: Locale,
): string | null {
  return decodeBase64UrlJsonCursor(raw, fingerprint(filters, locale));
}
