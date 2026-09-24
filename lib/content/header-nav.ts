import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { getStorefrontCopy } from "@/lib/content/storefront-copy";
import {
  DEFAULT_HEADER_NAV_ITEMS,
  DEFAULT_HEADER_NAV_LABEL_KEYS,
  HEADER_NAV_KEY,
  MAX_HEADER_NAV_ITEMS,
  MIN_HEADER_NAV_ITEMS,
  normalizeHeaderNavItem,
  parseHeaderNavData,
  type HeaderNavData,
  type HeaderNavItem,
} from "@/lib/content/header-nav-fields";

export {
  HEADER_NAV_KEY,
  DEFAULT_HEADER_NAV_ITEMS,
  MAX_HEADER_NAV_ITEMS,
  MIN_HEADER_NAV_ITEMS,
  resolveHeaderNav,
  type HeaderNavData,
  type HeaderNavItem,
  type ResolvedHeaderNavItem,
} from "@/lib/content/header-nav-fields";

function emptyLabelsFromLegacyCopy(
  copy: Awaited<ReturnType<typeof getStorefrontCopy>>,
): Record<string, Record<string, string>> {
  const labels: Record<string, Record<string, string>> = {};
  for (const [locale, fields] of Object.entries(copy)) {
    for (const [itemId, copyKey] of Object.entries(DEFAULT_HEADER_NAV_LABEL_KEYS)) {
      const value = fields[copyKey]?.trim();
      if (!value) continue;
      labels[locale] ??= {};
      labels[locale][itemId] = value;
    }
  }
  return labels;
}

function defaultHeaderNav(labels: Record<string, Record<string, string>> = {}): HeaderNavData {
  return {
    items: DEFAULT_HEADER_NAV_ITEMS.map((item) => ({ ...item })),
    labels,
  };
}

/**
 * Returns persisted header nav, or the shipped default menu.
 * When nothing is saved yet, seeds labels from legacy storefront-copy
 * `nav.home` / `nav.shop` / … overrides so existing customizations survive.
 */
export const getHeaderNav = cache(async (): Promise<HeaderNavData> => {
  const setting = await db.siteSetting.findUnique({ where: { key: HEADER_NAV_KEY } });
  const parsed = parseHeaderNavData(setting?.value);
  if (parsed) return parsed;

  const copy = await getStorefrontCopy();
  return defaultHeaderNav(emptyLabelsFromLegacyCopy(copy));
});

export async function setHeaderNav(next: HeaderNavData): Promise<HeaderNavData> {
  const items: HeaderNavItem[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < next.items.length; index += 1) {
    if (items.length >= MAX_HEADER_NAV_ITEMS) break;
    const item = normalizeHeaderNavItem(next.items[index], index);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  if (items.length < MIN_HEADER_NAV_ITEMS) {
    throw new Error(`Header navigation needs at least ${MIN_HEADER_NAV_ITEMS} link(s) with a path.`);
  }

  const validIds = new Set(items.map((item) => item.id));
  const labels: Record<string, Record<string, string>> = {};
  for (const [locale, localeLabels] of Object.entries(next.labels)) {
    const cleaned: Record<string, string> = {};
    for (const [itemId, label] of Object.entries(localeLabels)) {
      if (!validIds.has(itemId)) continue;
      const trimmed = label.trim();
      if (trimmed) cleaned[itemId] = trimmed;
    }
    if (Object.keys(cleaned).length > 0) labels[locale] = cleaned;
  }

  const value: HeaderNavData = { items, labels };
  await db.siteSetting.upsert({
    where: { key: HEADER_NAV_KEY },
    update: { value },
    create: { key: HEADER_NAV_KEY, value },
  });
  return value;
}
