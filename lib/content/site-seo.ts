import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  SITE_SEO_DEFAULTS,
  SITE_SEO_KEY,
  type SiteSeoFields,
} from "@/lib/content/site-seo-fields";

export { SITE_SEO_DEFAULTS, SITE_SEO_KEY, type SiteSeoFields };

const FIELD_KEYS = Object.keys(SITE_SEO_DEFAULTS) as (keyof SiteSeoFields)[];

function parseStored(value: unknown): Partial<SiteSeoFields> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const next: Partial<SiteSeoFields> = {};
  for (const key of FIELD_KEYS) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) next[key] = raw.trim();
  }
  return next;
}

function mergeWithDefaults(overrides: Partial<SiteSeoFields>): SiteSeoFields {
  return {
    defaultTitle: overrides.defaultTitle ?? SITE_SEO_DEFAULTS.defaultTitle,
    titleTemplate: overrides.titleTemplate ?? SITE_SEO_DEFAULTS.titleTemplate,
    description: overrides.description ?? SITE_SEO_DEFAULTS.description,
    ogTitle: overrides.ogTitle ?? SITE_SEO_DEFAULTS.ogTitle,
    ogDescription: overrides.ogDescription ?? SITE_SEO_DEFAULTS.ogDescription,
  };
}

export const getSiteSeo = cache(async (): Promise<SiteSeoFields> => {
  const setting = await db.siteSetting.findUnique({ where: { key: SITE_SEO_KEY } });
  return mergeWithDefaults(parseStored(setting?.value));
});

/** Raw overrides only (empty string means clear back to shipped default). */
export async function getSiteSeoOverrides(): Promise<Partial<SiteSeoFields>> {
  const setting = await db.siteSetting.findUnique({ where: { key: SITE_SEO_KEY } });
  return parseStored(setting?.value);
}

export async function setSiteSeo(updates: Partial<Record<keyof SiteSeoFields, string>>): Promise<SiteSeoFields> {
  const setting = await db.siteSetting.findUnique({ where: { key: SITE_SEO_KEY } });
  const next: Partial<SiteSeoFields> = { ...parseStored(setting?.value) };

  for (const key of FIELD_KEYS) {
    if (!(key in updates)) continue;
    const trimmed = (updates[key] ?? "").trim();
    if (trimmed) next[key] = trimmed;
    else delete next[key];
  }

  await db.siteSetting.upsert({
    where: { key: SITE_SEO_KEY },
    update: { value: next },
    create: { key: SITE_SEO_KEY, value: next },
  });

  return mergeWithDefaults(next);
}
