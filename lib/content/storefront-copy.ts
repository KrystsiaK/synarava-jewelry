import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { STOREFRONT_COPY_KEY } from "@/lib/content/storefront-copy-fields";

export { STOREFRONT_COPY_KEY };

export type StorefrontCopy = {
  en: Record<string, string>;
  pt: Record<string, string>;
};

function strings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].trim().length > 0,
    ),
  );
}

export const getStorefrontCopy = cache(async (): Promise<StorefrontCopy> => {
  const setting = await db.siteSetting.findUnique({ where: { key: STOREFRONT_COPY_KEY } });
  const value = setting?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return { en: {}, pt: {} };
  const record = value as Record<string, unknown>;
  return { en: strings(record.en), pt: strings(record.pt) };
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
export async function setStorefrontCopy(updates: {
  en: Record<string, string>;
  pt: Record<string, string>;
}): Promise<StorefrontCopy> {
  const setting = await db.siteSetting.findUnique({ where: { key: STOREFRONT_COPY_KEY } });
  const existing = setting?.value;
  const existingRecord = existing && typeof existing === "object" && !Array.isArray(existing)
    ? existing as Record<string, unknown>
    : {};
  const merged: StorefrontCopy = {
    en: applyUpdates(strings(existingRecord.en), updates.en),
    pt: applyUpdates(strings(existingRecord.pt), updates.pt),
  };

  await db.siteSetting.upsert({
    where: { key: STOREFRONT_COPY_KEY },
    update: { value: merged },
    create: { key: STOREFRONT_COPY_KEY, value: merged },
  });

  return merged;
}
