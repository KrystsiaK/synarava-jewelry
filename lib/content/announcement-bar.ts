import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  ANNOUNCEMENT_BAR_SETTING_KEY,
  DEFAULT_ANNOUNCEMENT_BAR_SETTING,
  type AnnouncementBarSetting,
  type FreeShippingMoney,
  type FreeShippingThresholdWindow,
} from "@/lib/content/announcement-bar-fields";

export {
  ANNOUNCEMENT_BAR_SETTING_KEY,
  ANNOUNCEMENT_BAR_COPY_KEY,
  FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
  DEFAULT_ANNOUNCEMENT_BAR_SETTING,
  type AnnouncementBarSetting,
  type FreeShippingMoney,
  type FreeShippingThresholdWindow,
} from "@/lib/content/announcement-bar-fields";

function asMoney(value: unknown): FreeShippingMoney | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const amount = typeof record.amount === "string" ? record.amount.trim() : "";
  const currencyCode = typeof record.currencyCode === "string" ? record.currencyCode.trim() : "";
  if (!amount || !currencyCode) return null;
  return { amount, currencyCode };
}

function asWindow(value: unknown): FreeShippingThresholdWindow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return { freeShippingMinSubtotal: asMoney(record.freeShippingMinSubtotal) };
}

export function parseAnnouncementBarSetting(value: unknown): AnnouncementBarSetting {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_ANNOUNCEMENT_BAR_SETTING };
  }
  const record = value as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    threshold: asMoney(record.threshold),
    shopifySnapshot: asWindow(record.shopifySnapshot),
  };
}

/** OUR commerce window — threshold only (Shopify-shaped). */
export function deriveFreeShippingThresholdWindow(
  setting: AnnouncementBarSetting,
): FreeShippingThresholdWindow {
  return { freeShippingMinSubtotal: setting.threshold };
}

/** Uncached DB read — sync waterfall must see post-refresh Shopify snapshots. */
export async function readAnnouncementBarSetting(): Promise<AnnouncementBarSetting> {
  const row = await db.siteSetting.findUnique({ where: { key: ANNOUNCEMENT_BAR_SETTING_KEY } });
  return parseAnnouncementBarSetting(row?.value);
}

export const getAnnouncementBarSetting = cache(async (): Promise<AnnouncementBarSetting> => {
  return readAnnouncementBarSetting();
});

export async function setAnnouncementBarEnabled(enabled: boolean): Promise<AnnouncementBarSetting> {
  const current = await readAnnouncementBarSetting();
  const next: AnnouncementBarSetting = { ...current, enabled };
  await db.siteSetting.upsert({
    where: { key: ANNOUNCEMENT_BAR_SETTING_KEY },
    update: { value: next },
    create: { key: ANNOUNCEMENT_BAR_SETTING_KEY, value: next },
  });
  return next;
}

/** Human Apply: copy Shopify observation → Synarava working threshold. */
export async function adoptFreeShippingThresholdFromShopify(): Promise<AnnouncementBarSetting> {
  const current = await readAnnouncementBarSetting();
  const remote = current.shopifySnapshot?.freeShippingMinSubtotal ?? null;
  if (!remote) {
    throw new Error("No Shopify free-shipping threshold observation to adopt.");
  }
  const next: AnnouncementBarSetting = {
    ...current,
    threshold: { ...remote },
  };
  await db.siteSetting.upsert({
    where: { key: ANNOUNCEMENT_BAR_SETTING_KEY },
    update: { value: next },
    create: { key: ANNOUNCEMENT_BAR_SETTING_KEY, value: next },
  });
  return next;
}

/**
 * Refresh-only: persist Shopify observation. Never writes `threshold` / `enabled`
 * (ADR-0008 — nothing automatic writes Synarava content).
 */
export async function refreshAnnouncementBarShopifySnapshot(
  snapshot: FreeShippingThresholdWindow | null,
): Promise<AnnouncementBarSetting> {
  const current = await readAnnouncementBarSetting();
  const next: AnnouncementBarSetting = {
    ...current,
    shopifySnapshot: snapshot,
  };
  await db.siteSetting.upsert({
    where: { key: ANNOUNCEMENT_BAR_SETTING_KEY },
    update: { value: next },
    create: { key: ANNOUNCEMENT_BAR_SETTING_KEY, value: next },
  });
  return next;
}
