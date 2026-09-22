import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { STOREFRONT_COPY_KEY } from "@/lib/content/storefront-copy-fields";

export { STOREFRONT_COPY_KEY };

// Keyed by registry locale code ("en", "pt", "ru", ...) — any locale can
// hold an override, not just a fixed EN/PT pair. A locale with no entry
// here simply has no override yet; readers (getServerTranslations) already
// fall back to the English dictionary for any missing key.
export type StorefrontCopy = Record<string, Record<string, string>>;

function strings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].trim().length > 0,
    ),
  );
}

function allLocales(value: unknown): StorefrontCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(record).map(([locale, v]) => [locale, strings(v)]));
}

export const getStorefrontCopy = cache(async (): Promise<StorefrontCopy> => {
  const setting = await db.siteSetting.findUnique({ where: { key: STOREFRONT_COPY_KEY } });
  return allLocales(setting?.value);
});

// Callers submit the full set of fields they manage every save (empty string
// included), so an empty value here means "clear this override, fall back to
// the shipped default" rather than "leave whatever was there alone".
function applyUpdates(base: Record<string, string>, updates: Record<string, string>) {
  const next = { ...base };
  for (const [key, value] of Object.entries(updates)) {
    const trimmed = value.trim();
    if (trimmed) next[key] = trimmed;
    else delete next[key];
  }
  return next;
}

// Not wrapped in getStorefrontCopy's per-request cache() — callers that need
// the fresh value right after a write (e.g. the settings admin form) should
// read the upsert result instead of calling getStorefrontCopy() again.
export async function setStorefrontCopy(updates: StorefrontCopy): Promise<StorefrontCopy> {
  const setting = await db.siteSetting.findUnique({ where: { key: STOREFRONT_COPY_KEY } });
  const merged = allLocales(setting?.value);
  for (const [locale, localeUpdates] of Object.entries(updates)) {
    merged[locale] = applyUpdates(merged[locale] ?? {}, localeUpdates);
  }

  await db.siteSetting.upsert({
    where: { key: STOREFRONT_COPY_KEY },
    update: { value: merged },
    create: { key: STOREFRONT_COPY_KEY, value: merged },
  });

  return merged;
}
