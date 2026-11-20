import { isAdminRequestPath } from "@/lib/analytics/optional-analytics-ids";
import { stripLocalePrefix } from "@/lib/i18n/routing";

/**
 * Where the free-shipping marquee mounts for a request.
 * - `layout` — shared storefront locale layout mounts it under the header
 * - `none` — 404/unknown, error surfaces, admin, About, or non-storefront
 *
 * Single exception list for storefront chrome. Do not scatter per-page checks.
 */
export type AnnouncementMarqueeMount = "layout" | "none";

/**
 * Locale-stripped path prefixes (and exact paths) that receive the layout-owned
 * marquee. Home (`/`) is included. About is excluded. Unknown paths (including
 * soft 404 URLs) stay `none` so error/not-found views never show a banner.
 */
export const STOREFRONT_ANNOUNCEMENT_LAYOUT_PATHS = [
  "/shop",
  "/products",
  "/artifacts",
  "/collections",
  "/cart",
  "/privacy",
  "/terms-and-conditions",
  "/returns",
  "/shipping",
  "/cookie-settings",
  "/dispute-resolution",
  "/offer",
  "/care",
  "/faq",
] as const;

function matchesLayoutPath(path: string): boolean {
  for (const prefix of STOREFRONT_ANNOUNCEMENT_LAYOUT_PATHS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

/**
 * Resolve marquee mount from the proxy `x-pathname` (or any absolute path).
 * Admin and non-allowlisted paths never mount; home uses layout like other
 * storefront routes.
 */
export function resolveAnnouncementMarqueeMount(
  pathname: string | null | undefined,
): AnnouncementMarqueeMount {
  if (!pathname) return "none";
  if (isAdminRequestPath(pathname)) return "none";

  const path = stripLocalePrefix(pathname);
  if (path === "/" || path === "") return "layout";
  if (matchesLayoutPath(path)) return "layout";
  return "none";
}

export function shouldMountLayoutAnnouncementMarquee(
  pathname: string | null | undefined,
): boolean {
  return resolveAnnouncementMarqueeMount(pathname) === "layout";
}
