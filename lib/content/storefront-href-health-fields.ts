/**
 * Storefront href health — missing / draft targets for nav & footer links.
 * Client-safe classifiers; DB lookups live in storefront-link-health.ts.
 */

import { looksLikePath, normalizeHrefQuery } from "@/lib/admin/storefront-href";

export type StorefrontHrefHealth =
  | "live"
  | "draft"
  | "unlisted"
  | "missing"
  | "external"
  | "empty";

/** App routes that are not CMS Page rows but are always live on the storefront. */
export const EXTRA_LIVE_STOREFRONT_PATHS = new Set([
  "/cookie-settings",
]);

export function classifyHrefWithoutLookup(href: string): StorefrontHrefHealth | null {
  const trimmed = normalizeHrefQuery(href);
  if (!trimmed) return "empty";
  if (/^https?:\/\//i.test(trimmed)) return "external";
  if (/^mailto:/i.test(trimmed)) return "external";
  const path = trimmed === "/" ? "/" : trimmed.replace(/\/+$/, "") || "/";
  if (EXTRA_LIVE_STOREFRONT_PATHS.has(path)) {
    return "live";
  }
  if (!looksLikePath(trimmed)) return "missing";
  return null;
}

/** Keep on the storefront view; hide missing/empty/draft. */
export function isStorefrontVisibleHealth(health: StorefrontHrefHealth): boolean {
  return health === "live" || health === "external" || health === "unlisted";
}
