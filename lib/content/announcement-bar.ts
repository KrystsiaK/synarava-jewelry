import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  ANNOUNCEMENT_BAR_SETTING_KEY,
  DEFAULT_ANNOUNCEMENT_BAR_SETTING,
  type AnnouncementBarSetting,
  type FreeShippingMoney,
  type FreeShippingObservationSource,
  type FreeShippingThresholdWindow,
} from "@/lib/content/announcement-bar-fields";

export {
  ANNOUNCEMENT_BAR_SETTING_KEY,
  ANNOUNCEMENT_BAR_COPY_KEY,
  FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
  DEFAULT_ANNOUNCEMENT_BAR_SETTING,
  type AnnouncementBarSetting,
  type FreeShippingMoney,
  type FreeShippingObservationSource,
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

function asSource(value: unknown): FreeShippingObservationSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const profileName = typeof record.profileName === "string" ? record.profileName.trim() : "";
  const zoneName = typeof record.zoneName === "string" ? record.zoneName.trim() : "";
  const rateName = typeof record.rateName === "string" ? record.rateName.trim() : "";
  if (!profileName || !zoneName || !rateName) return null;
  return { profileName, zoneName, rateName };
}

export function parseAnnouncementBarSetting(value: unknown): AnnouncementBarSetting {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_ANNOUNCEMENT_BAR_SETTING };
  }
  const record = value as Record<string, unknown>;
  const observationError =
    typeof record.shopifyObservationError === "string"
      ? record.shopifyObservationError.trim() || null
      : null;
  const observationWarning =
    typeof record.shopifyObservationWarning === "string"
      ? record.shopifyObservationWarning.trim() || null
      : null;
  return {
    enabled: record.enabled === true,
    threshold: asMoney(record.threshold),
    shopifySnapshot: asWindow(record.shopifySnapshot),
    shopifyObservationError: observationError,
    shopifyObservationSource: asSource(record.shopifyObservationSource),
    shopifyObservationWarning: observationWarning,
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
 * Refresh-only: persist Shopify observation (+ optional read error / source / warning).
 * Never writes `threshold` / `enabled` (ADR-0008 — nothing automatic writes Synarava content).
 * Pass `snapshot: undefined` to leave the last window unchanged (failed read).
 *
 * Observation error persistence: always store the latest `error` when provided.
 * Clear it only when THIS refresh observes a fresh non-null amount. Keeping a prior
 * snapshot amount must not swallow a new read failure (skipRefresh would otherwise
 * look “fine” with Threshold: — and no reason).
 */
export async function refreshAnnouncementBarShopifySnapshot(input: {
  snapshot?: FreeShippingThresholdWindow | null;
  error?: string | null;
  source?: FreeShippingObservationSource | null;
  warning?: string | null;
}): Promise<AnnouncementBarSetting> {
  const current = await readAnnouncementBarSetting();
  const snapshotProvided = input.snapshot !== undefined;
  const nextSnapshot = snapshotProvided ? input.snapshot! : current.shopifySnapshot;
  const freshAmount = snapshotProvided
    ? (input.snapshot?.freeShippingMinSubtotal ?? null)
    : null;

  const nextError = freshAmount
    ? null
    : (input.error !== undefined ? (input.error ?? null) : current.shopifyObservationError);

  const nextSource = freshAmount
    ? (input.source ?? null)
    : (input.source !== undefined ? input.source : current.shopifyObservationSource);

  const nextWarning = freshAmount
    ? (input.warning ?? null)
    : (input.warning !== undefined ? input.warning : current.shopifyObservationWarning);

  const next: AnnouncementBarSetting = {
    ...current,
    shopifySnapshot: nextSnapshot,
    shopifyObservationError: nextError,
    shopifyObservationSource: nextSource,
    shopifyObservationWarning: nextWarning,
  };
  await db.siteSetting.upsert({
    where: { key: ANNOUNCEMENT_BAR_SETTING_KEY },
    update: { value: next },
    create: { key: ANNOUNCEMENT_BAR_SETTING_KEY, value: next },
  });
  return next;
}
