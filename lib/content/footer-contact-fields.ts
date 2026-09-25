/** Shared footer contact emails (not localized). Client-safe defaults. */

export const FOOTER_CONTACT_KEY = "footer-contact-v1";

export const DEFAULT_FOOTER_CONTACT_EMAIL = "synarava.shop@gmail.com";

export const MAX_FOOTER_CONTACT_EMAILS = 8;
export const MIN_FOOTER_CONTACT_EMAILS = 1;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FooterContactData = {
  /** Ordered mailto addresses. First is used by the shared contact CTA. */
  emails: string[];
};

export function normalizeFooterContactEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

export function parseFooterContact(value: unknown): FooterContactData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as { email?: unknown; emails?: unknown };

  const emails: string[] = [];
  const seen = new Set<string>();

  const push = (raw: unknown) => {
    const email = normalizeFooterContactEmail(raw);
    if (!email || seen.has(email.toLowerCase())) return;
    seen.add(email.toLowerCase());
    emails.push(email);
  };

  if (Array.isArray(record.emails)) {
    for (const entry of record.emails) {
      if (emails.length >= MAX_FOOTER_CONTACT_EMAILS) break;
      push(entry);
    }
  }

  // Legacy single-email shape.
  if (emails.length === 0) push(record.email);

  if (emails.length < MIN_FOOTER_CONTACT_EMAILS) return null;
  return { emails };
}

export function cleanFooterContactEmails(raw: unknown[]): FooterContactData {
  const emails: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (emails.length >= MAX_FOOTER_CONTACT_EMAILS) break;
    const email = normalizeFooterContactEmail(entry);
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    emails.push(email);
  }
  if (emails.length < MIN_FOOTER_CONTACT_EMAILS) {
    throw new Error("Add at least one valid contact email.");
  }
  return { emails };
}
