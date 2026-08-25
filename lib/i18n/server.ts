import "server-only";

import { cookies } from "next/headers";
import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import { normalizeLocale } from "./locales";
import { flattenMessages } from "./utils";

type Values = Record<string, string | number>;

const dictionaries = {
  en: flattenMessages(en as Record<string, unknown>),
  pt: flattenMessages(pt as Record<string, unknown>),
};

export async function getRequestLocale() {
  return normalizeLocale((await cookies()).get("synarava-locale")?.value);
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
