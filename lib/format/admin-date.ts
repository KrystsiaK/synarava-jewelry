/**
 * Canonical admin date/time display — one format everywhere in admin UI.
 * Locale and time zone are fixed so SSR and client render the same string
 * (no hydration mismatch, no browser-locale drift).
 *
 * Shape matches the product/collection table meta line:
 *   datetime → "30 Sept 2026, 23:11"
 *   date     → "30 Sept 2026"
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
 */

/** Same locale the table meta line already used (`en-IE` → "30 Sept 2026"). */
export const ADMIN_DATE_LOCALE = "en-IE";

/**
 * Explicit zone so server and client match. UTC matches production Node /
 * Vercel default and existing mission-control timestamps.
 */
export const ADMIN_DATE_TIME_ZONE = "UTC";

const dateTimeFormatter = new Intl.DateTimeFormat(ADMIN_DATE_LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ADMIN_DATE_TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat(ADMIN_DATE_LOCALE, {
  dateStyle: "medium",
  timeZone: ADMIN_DATE_TIME_ZONE,
});

function asDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "30 Sept 2026, 23:11" — 24h, no seconds. */
export function formatAdminDateTime(value: Date | string | number): string {
  return dateTimeFormatter.format(asDate(value));
}

/** "30 Sept 2026" — date only. */
export function formatAdminDate(value: Date | string | number): string {
  return dateFormatter.format(asDate(value));
}
