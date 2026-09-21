// Explicit allowlist for Legal Document "action:" links (see
// components/legal/legal-document-page.tsx and legal-action-link.tsx).
// Content only ever supplies a short identifier that is looked up against
// this fixed list — never a URL, script, or anything executed dynamically —
// so an unrecognized identifier can only fail closed to plain text, never
// run arbitrary behavior.
export const LEGAL_ACTION_IDS = ["cookie-settings"] as const;

export type LegalActionId = (typeof LEGAL_ACTION_IDS)[number];

const ACTION_HREF_PREFIX = "action:";

export function isLegalActionHref(href: string): boolean {
  return href.startsWith(ACTION_HREF_PREFIX);
}

/** Returns the action id for a recognized `action:` href, or null (including for an unrecognized identifier). */
export function parseLegalActionHref(href: string): LegalActionId | null {
  if (!isLegalActionHref(href)) return null;
  const id = href.slice(ACTION_HREF_PREFIX.length);
  return (LEGAL_ACTION_IDS as readonly string[]).includes(id) ? (id as LegalActionId) : null;
}
