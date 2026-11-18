/**
 * Client-safe honesty helpers for the admin announcement-bar threshold strip.
 * Shopify amount comes from shopifySnapshot only — never from local `threshold`.
 */

import type {
  AnnouncementBarSetting,
  FreeShippingMoney,
  FreeShippingObservationSource,
} from "@/lib/content/announcement-bar-fields";

export type AnnouncementThresholdHonestyStatus =
  | { kind: "matches" }
  | { kind: "differs" }
  | { kind: "reason"; message: string }
  | { kind: "unchecked" };

function moneyEquals(a: FreeShippingMoney | null, b: FreeShippingMoney | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const left = Number.parseFloat(a.amount);
  const right = Number.parseFloat(b.amount);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return a.amount === b.amount && a.currencyCode === b.currencyCode;
  }
  return left === right && a.currencyCode === b.currencyCode;
}

/** Shopify-owned amount from the persisted observation window. */
export function shopifyThresholdFromSetting(
  setting: Pick<AnnouncementBarSetting, "shopifySnapshot">,
): FreeShippingMoney | null {
  return setting.shopifySnapshot?.freeShippingMinSubtotal ?? null;
}

export function formatObservationSource(
  source: FreeShippingObservationSource | null | undefined,
): string | null {
  if (!source) return null;
  return `${source.profileName} / ${source.zoneName} / ${source.rateName}`;
}

/**
 * Always one of: matches Shopify, differs (ConflictResolver), a concrete reason,
 * or unchecked (no snapshot and no error yet).
 */
export function announcementThresholdHonestyStatus(input: {
  setting: Pick<
    AnnouncementBarSetting,
    "threshold" | "shopifySnapshot" | "shopifyObservationError"
  >;
  conflictCount: number;
}): AnnouncementThresholdHonestyStatus {
  const { setting, conflictCount } = input;
  const shopify = shopifyThresholdFromSetting(setting);
  const error = setting.shopifyObservationError?.trim() || null;

  // Latest read failure always wins — even when a prior snapshot amount remains.
  // (skipRefresh would otherwise claim "matches" while hiding a revoked scope.)
  if (error) {
    return { kind: "reason", message: error };
  }
  if (conflictCount > 0) {
    return { kind: "differs" };
  }
  if (shopify && moneyEquals(setting.threshold, shopify)) {
    return { kind: "matches" };
  }
  if (shopify && !moneyEquals(setting.threshold, shopify)) {
    // Snapshot present and values diverge but SyncResult leaf count was 0 —
    // still be honest about the mismatch (e.g. compare edge cases).
    return { kind: "differs" };
  }
  if (!setting.shopifySnapshot) {
    return { kind: "unchecked" };
  }
  // Snapshot object exists but amount is null and no error was persisted.
  return {
    kind: "reason",
    message: "No free shipping rate found for Portugal (PT) in Shopify.",
  };
}
