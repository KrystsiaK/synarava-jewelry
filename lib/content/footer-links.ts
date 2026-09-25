import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { getStorefrontCopy } from "@/lib/content/storefront-copy";
import {
  DEFAULT_FOOTER_LEGAL_LABEL_KEYS,
  DEFAULT_FOOTER_LEGAL_ITEMS,
  DEFAULT_FOOTER_SERVICE_LABEL_KEYS,
  DEFAULT_FOOTER_SERVICE_ITEMS,
  FOOTER_LINKS_KEY,
  cleanFooterLinkColumn,
  defaultFooterLinks,
  parseFooterLinksData,
  type FooterLinkColumn,
  type FooterLinksData,
} from "@/lib/content/footer-links-fields";

export {
  FOOTER_LINKS_KEY,
  DEFAULT_FOOTER_SERVICE_ITEMS,
  DEFAULT_FOOTER_LEGAL_ITEMS,
  DEFAULT_FOOTER_SERVICE_LABEL_KEYS,
  DEFAULT_FOOTER_LEGAL_LABEL_KEYS,
  MAX_FOOTER_LINK_ITEMS,
  resolveFooterLinkColumn,
  isExternalHref,
  type FooterLinksData,
  type FooterLinkColumn,
  type FooterLinkItem,
  type ResolvedFooterLink,
} from "@/lib/content/footer-links-fields";

function labelsFromLegacyCopy(
  copy: Awaited<ReturnType<typeof getStorefrontCopy>>,
  keys: Record<string, string>,
): Record<string, Record<string, string>> {
  const labels: Record<string, Record<string, string>> = {};
  for (const [locale, fields] of Object.entries(copy)) {
    for (const [itemId, copyKey] of Object.entries(keys)) {
      const value = fields[copyKey]?.trim();
      if (!value) continue;
      labels[locale] ??= {};
      labels[locale][itemId] = value;
    }
  }
  return labels;
}

/**
 * Returns persisted footer link columns, or shipped defaults.
 * Seeds labels from legacy storefront-copy overrides when nothing is saved yet.
 */
export const getFooterLinks = cache(async (): Promise<FooterLinksData> => {
  const setting = await db.siteSetting.findUnique({ where: { key: FOOTER_LINKS_KEY } });
  const parsed = parseFooterLinksData(setting?.value);
  if (parsed) return parsed;

  const copy = await getStorefrontCopy();
  return defaultFooterLinks({
    service: labelsFromLegacyCopy(copy, DEFAULT_FOOTER_SERVICE_LABEL_KEYS),
    legal: labelsFromLegacyCopy(copy, DEFAULT_FOOTER_LEGAL_LABEL_KEYS),
  });
});

export async function setFooterLinks(next: FooterLinksData): Promise<FooterLinksData> {
  const value: FooterLinksData = {
    service: cleanFooterLinkColumn(next.service),
    legal: cleanFooterLinkColumn(next.legal),
    socials: cleanFooterLinkColumn(next.socials),
  };

  await db.siteSetting.upsert({
    where: { key: FOOTER_LINKS_KEY },
    update: { value },
    create: { key: FOOTER_LINKS_KEY, value },
  });
  return value;
}
