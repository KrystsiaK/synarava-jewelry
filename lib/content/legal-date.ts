import { resolveLegalText } from "@/lib/content/legal-sections";

/**
 * Shared legal dates are stored as one English display string
 * (`5 September 2026`). Month names and an optional `{day} {month} {year}`
 * pattern live in the locale dictionary (`legal.common.months.*`,
 * `legal.common.datePattern`) — they are not admin fields.
 *
 * Adding a language: `docs/translation-operations.md` (Adding a new language).
 * If that dictionary has no month names, this returns the source string.
 */

const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const SHARED_LEGAL_DATE = new RegExp(
  `^(\\d{1,2})\\s+(${ENGLISH_MONTHS.join("|")})\\s+(\\d{4})$`,
);

export function legalMonthMessageKey(englishMonth: string) {
  return `legal.common.months.${englishMonth.toLowerCase()}`;
}

export const LEGAL_DATE_PATTERN_KEY = "legal.common.datePattern";

type Translate = (key: string) => string;

function dictionaryValue(translate: Translate, key: string) {
  const value = translate(key).trim();
  return value && value !== key ? value : "";
}

/**
 * Formats the one shared legal date for the active locale.
 * Unrecognized strings (not `day Month year` with an English month) stay as typed.
 * Missing month names leave the source language in place.
 */
export function formatSharedLegalDate(date: string, translate: Translate): string {
  const match = date.trim().match(SHARED_LEGAL_DATE);
  if (!match) return date;

  const day = match[1];
  const month = match[2];
  const year = match[3];
  if (!day || !month || !year) return date;

  const monthName = dictionaryValue(translate, legalMonthMessageKey(month));
  if (!monthName) return date;

  const pattern = dictionaryValue(translate, LEGAL_DATE_PATTERN_KEY);
  if (!pattern) return `${day} ${monthName} ${year}`;

  return pattern
    .replaceAll("{day}", day)
    .replaceAll("{month}", monthName)
    .replaceAll("{year}", year);
}

/** Admin label for the active locale, or the dictionary key when that field is empty. */
export function resolveLegalLastUpdatedLabel(
  adminLabel: string | undefined,
  dictionaryLabel: string,
) {
  return resolveLegalText(adminLabel, dictionaryLabel);
}

export function resolveSharedLegalDate(input: {
  date: string | undefined;
  saved: boolean;
  fallbackDate: string;
  translate: Translate;
}) {
  const source = resolveLegalText(input.date, input.saved ? "" : input.fallbackDate);
  return formatSharedLegalDate(source, input.translate);
}
