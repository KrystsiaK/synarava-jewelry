/** Canonical Shared admin section path (legacy: `/admin/settings`). */
export const ADMIN_SHARED_PATH = "/admin/shared" as const;

/** Pre-rename path — permanent redirect target only. */
export const ADMIN_SHARED_LEGACY_PATH = "/admin/settings" as const;

/** Shared section deep link. Pass hash without `#`, or omit for the section root. */
export function adminSharedHref(hash?: string): string {
  if (!hash) return ADMIN_SHARED_PATH;
  return `${ADMIN_SHARED_PATH}#${hash.replace(/^#/, "")}`;
}
