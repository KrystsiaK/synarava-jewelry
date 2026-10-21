import "server-only";

import { headers } from "next/headers";
import { normalizeLocale, type Locale } from "./locales";
import { getEnglishMessages, getFlatMessages } from "./message-catalog";
import { mergeLocaleOverrides } from "./utils";
import { getStorefrontCopy } from "@/lib/content/storefront-copy";
import { getCommerceCopy } from "@/lib/content/commerce-copy";
import { glueOrphanPunctuation } from "@/lib/text/glue-orphan-punctuation";

type Values = Record<string, string | number>;

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
  const [storefrontCopy, commerceCopy] = await Promise.all([getStorefrontCopy(), getCommerceCopy()]);
  const overrides = mergeLocaleOverrides(storefrontCopy, commerceCopy);
  const messages = { ...getFlatMessages(locale), ...overrides[locale] };
  const fallback = getEnglishMessages();
  const interpolate = (message: string, values?: Values) => {
    const filled = values
      ? message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => (
          Object.hasOwn(values, key) ? String(values[key]) : match
        ))
      : message;
    return glueOrphanPunctuation(filled);
  };

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

export type { Locale };
