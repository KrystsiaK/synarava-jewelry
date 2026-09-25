// Explicit allowlist for Legal Document "action:" links (legacy content).
// Prefer plain storefront paths (e.g. `/cookie-settings`) in new WYSIWYG copy.
// Unrecognized identifiers fail closed — never execute arbitrary behavior.
export const LEGAL_ACTION_IDS = ["cookie-settings"] as const;

export type LegalActionId = (typeof LEGAL_ACTION_IDS)[number];

/** Canonical in-app path for each allowlisted action id. */
export const LEGAL_ACTION_PATHS = {
  "cookie-settings": "/cookie-settings",
} as const satisfies Record<LegalActionId, string>;

const ACTION_HREF_PREFIX = "action:";

export function isLegalActionHref(href: string): boolean {
  return href.startsWith(ACTION_HREF_PREFIX);
}

/** Returns the action id for a recognized `action:` href, or null. */
export function parseLegalActionHref(href: string): LegalActionId | null {
  if (!isLegalActionHref(href)) return null;
  const id = href.slice(ACTION_HREF_PREFIX.length);
  return (LEGAL_ACTION_IDS as readonly string[]).includes(id) ? (id as LegalActionId) : null;
}

/** Maps an allowlisted `action:` href to its storefront path, or null. */
export function resolveLegalActionPath(href: string): string | null {
  const id = parseLegalActionHref(href);
  return id ? LEGAL_ACTION_PATHS[id] : null;
}
