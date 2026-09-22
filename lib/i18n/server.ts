import "server-only";

import { headers } from "next/headers";
import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
import { normalizeLocale, type Locale } from "./locales";
import { flattenMessages } from "./utils";
import { getStorefrontCopy } from "@/lib/content/storefront-copy";

type Values = Record<string, string | number>;

const enDictionary = flattenMessages(en as Record<string, unknown>);

// Not every registered locale has a static dictionary file — `dictionaries[locale]`
// is simply undefined for those, and getServerTranslations already falls
// back to `enDictionary` for any missing key.
const dictionaries: Partial<Record<Locale, Record<string, string>>> = {
  en: enDictionary,
  pt: flattenMessages(pt as Record<string, unknown>),
  ru: flattenMessages(ru as Record<string, unknown>),
};

/**
 * Reads the current locale from the `x-locale` request header, which
 * `proxy.ts` sets from the URL's locale prefix before the
 * request reaches any page or Server Action. There is deliberately no
 * cookie fallback here: locale must be derivable from the URL alone so a
 * crawler (which never carries the old locale-preference cookie) sees the
 * same content a real visitor does at that URL.
 */
export async function getRequestLocale() {
  return normalizeLocale((await headers()).get("x-locale"));
}

export async function getServerTranslations() {
  const locale = await getRequestLocale();
  const overrides = await getStorefrontCopy();
  const messages = { ...dictionaries[locale], ...overrides[locale] };
  const fallback = enDictionary;
  const interpolate = (message: string, values?: Values) => values
    ? message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => (
        Object.hasOwn(values, key) ? String(values[key]) : match
      ))
    : message;

  return {
    locale,
    t: (key: string, values?: Values) => interpolate(messages[key] ?? fallback[key] ?? key, values),
    plural: (key: string, count: number, values?: Values) => {
      const category = new Intl.PluralRules(locale).select(count);
      return interpolate(
        messages[`${key}.${category}`] ?? messages[`${key}.other`] ?? fallback[`${key}.${category}`] ?? fallback[`${key}.other`] ?? key,
        { ...values, count },
      );
    },
  };
}
