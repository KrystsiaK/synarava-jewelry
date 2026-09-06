import "server-only";

import { headers } from "next/headers";
import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import { normalizeLocale } from "./locales";
import { flattenMessages } from "./utils";

type Values = Record<string, string | number>;

const dictionaries = {
  en: flattenMessages(en as Record<string, unknown>),
  pt: flattenMessages(pt as Record<string, unknown>),
};

/**
 * Reads the current locale from the `x-locale` request header, which
 * `proxy.ts` sets from the URL's `/en/...` or `/pt/...` prefix before the
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
  const messages = dictionaries[locale];
  const fallback = dictionaries.en;
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
