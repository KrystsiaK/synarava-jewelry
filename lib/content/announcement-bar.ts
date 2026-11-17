import "server-only";

import { revalidatePath } from "next/cache";
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

function asCheckedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function parseAnnouncementBarSetting(value: unknown): AnnouncementBarSetting {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_ANNOUNCEMENT_BAR_SETTING };
  }
  const record = value as Record<string, unknown>;
  // Legacy `threshold` keys are ignored — Shopify snapshot is the sole amount source.
  return {
    enabled: record.enabled === true,
    shopifySnapshot: asWindow(record.shopifySnapshot),
    shopifyCheckedAt: asCheckedAt(record.shopifyCheckedAt),
  };
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

/**
 * Refresh-only: persist Shopify observation + checked-at.
 * Never writes Synarava on/off or banner copy (ADR-0008).
 */
export async function refreshAnnouncementBarShopifySnapshot(
  snapshot: FreeShippingThresholdWindow | null,
): Promise<AnnouncementBarSetting> {
  const current = await readAnnouncementBarSetting();
  const next: AnnouncementBarSetting = {
    ...current,
    shopifySnapshot: snapshot,
    shopifyCheckedAt: new Date().toISOString(),
  };
  await db.siteSetting.upsert({
    where: { key: ANNOUNCEMENT_BAR_SETTING_KEY },
    update: { value: next },
    create: { key: ANNOUNCEMENT_BAR_SETTING_KEY, value: next },
  });
  revalidatePath("/");
  return next;
}
