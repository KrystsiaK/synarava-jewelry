/** Shared footer contact email (not localized). Client-safe defaults. */

export const FOOTER_CONTACT_KEY = "footer-contact-v1";

export const DEFAULT_FOOTER_CONTACT_EMAIL = "synarava.shop@gmail.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeFooterContactEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

export function parseFooterContact(value: unknown): { email: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const email = normalizeFooterContactEmail((value as { email?: unknown }).email);
  if (!email) return null;
  return { email };
}
