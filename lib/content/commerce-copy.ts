import "server-only";

import { cache } from "react";

import { COMMERCE_COPY_KEY } from "@/lib/content/commerce-copy-fields";
import type { LocaleCopy } from "@/lib/content/commerce-copy-fields";
import { db } from "@/lib/db";

export { COMMERCE_COPY_KEY };

function strings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].trim().length > 0,
    ),
  );
}

function allLocales(value: unknown): LocaleCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(record).map(([locale, v]) => [locale, strings(v)]));
}

function applyUpdates(base: Record<string, string>, updates: Record<string, string>) {
  const next = { ...base };
  for (const [key, value] of Object.entries(updates)) {
    const trimmed = value.trim();
    if (trimmed) next[key] = trimmed;
    else delete next[key];
  }
  return next;
}

export const getCommerceCopy = cache(async (): Promise<LocaleCopy> => {
  const setting = await db.siteSetting.findUnique({ where: { key: COMMERCE_COPY_KEY } });
  return allLocales(setting?.value);
});

export async function setCommerceCopy(updates: LocaleCopy): Promise<LocaleCopy> {
  const setting = await db.siteSetting.findUnique({ where: { key: COMMERCE_COPY_KEY } });
  const merged = allLocales(setting?.value);
  for (const [locale, localeUpdates] of Object.entries(updates)) {
    merged[locale] = applyUpdates(merged[locale] ?? {}, localeUpdates);
  }

  await db.siteSetting.upsert({
    where: { key: COMMERCE_COPY_KEY },
    update: { value: merged },
    create: { key: COMMERCE_COPY_KEY, value: merged },
  });

  return merged;
}
