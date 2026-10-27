/**
 * Every sync action runs this loop:
 * 1. Fetch full Shopify state
 * 2. Read our Synarava state
 * 3. Compare in ONE function
 * 4. Return SyncResult for selectSyncCounts / UI render
 */

import "server-only";

import { logSyncWaterfallTiming, measureMs } from "@/lib/shopify/admin-telemetry";
import { compareSyncState } from "./compare";
import { readSynaravaStateForCompare } from "./read-synarava-state";
import {
  refreshShopifyState,
  type RefreshShopifyStateScope,
  type RefreshShopifyStateTiming,
} from "./refresh-shopify-state";
import type { SyncResult } from "./types";

export type SyncWaterfallResult = {
  result: SyncResult;
  warning?: string;
  alreadyRunning?: boolean;
};

function emitWaterfallTiming(input: {
  scope: RefreshShopifyStateScope;
  trigger: string | null;
  totalMs: number;
  compareReadMs: number;
  compareCpuMs: number;
  timing?: RefreshShopifyStateTiming;
  status: string;
  warningCount: number;
}) {
  const t = input.timing;
  logSyncWaterfallTiming({
    scopeKind: input.scope.kind,
    trigger: t?.trigger ?? input.trigger,
    totalMs: input.totalMs,
    translationsMs: t?.translationsMs ?? 0,
    productPresenceMs: t?.productPresenceMs ?? 0,
    collectionPresenceMs: t?.collectionPresenceMs ?? 0,
    productCommerceMs: t?.productCommerceMs ?? 0,
    collectionCommerceMs: t?.collectionCommerceMs ?? 0,
    compareReadMs: input.compareReadMs,
    compareCpuMs: input.compareCpuMs,
    linkedProductCount: t?.linkedProductCount ?? 0,
    linkedCollectionCount: t?.linkedCollectionCount ?? 0,
    translationBindingCount: t?.translationBindingCount ?? 0,
    localeCount: t?.localeCount ?? 0,
    warningCount: input.warningCount,
    status: input.status,
  });
}

/**
 * Waterfall entry — admin load, post-Save, post-Apply, and Check all call this.
 * After any human Apply leaf, callers must invoke again.
 *
 * checkedAt is stamped only after a fresh SUCCEEDED catalog refresh — never on
 * reused/skipped/partial/failed runs (those keep the prior successful time).
 */
export async function runSyncWaterfall(input: {
  scope: RefreshShopifyStateScope;
  requestedBy: string;
  /** Skip network refresh (e.g. layout badge from already-persisted state). */
  skipRefresh?: boolean;
  /** Top-bar AUTO/MANUAL; forwarded to catalog refresh translation run. */
  trigger?: "AUTO" | "MANUAL";
}): Promise<SyncWaterfallResult> {
  const totalStarted = performance.now();
  let warning: string | undefined;
  let checkedAt: string | null | undefined;
  let refreshTiming: RefreshShopifyStateTiming | undefined;
  let status = input.skipRefresh ? "skip_refresh" : "SUCCEEDED";

  if (!input.skipRefresh) {
    const refreshed = await refreshShopifyState(input.scope, input.requestedBy, {
      trigger: input.trigger,
    });
    refreshTiming = refreshed.timing;
    if (refreshed.alreadyRunning) {
      const readTimed = await measureMs(() =>
        readSynaravaStateForCompare(input.scope, { adminUsername: input.requestedBy }),
      );
      const compareTimed = measureSyncCompare(readTimed.value);
      emitWaterfallTiming({
        scope: input.scope,
        trigger: input.trigger ?? null,
        totalMs: Math.round(performance.now() - totalStarted),
        compareReadMs: readTimed.ms,
        compareCpuMs: compareTimed.ms,
        timing: refreshTiming,
        status: "already_running",
        warningCount: 1,
      });
      return {
        result: compareTimed.value,
        warning: "already running",
        alreadyRunning: true,
      };
    }
    warning = refreshed.warning;
    status = refreshTiming?.status
      ?? refreshed.runStatus
      ?? (refreshed.reused ? "reused" : refreshed.ok ? "SUCCEEDED" : "FAILED");
    // Stamp checkedAt only after a fresh SUCCEEDED *catalog* run (top-bar /
    // once-per-login). Scoped product/collection post-action refreshes must
    // not overwrite the latest complete catalog checkedAt / status.
    if (
      input.scope.kind === "catalog"
      && refreshed.ok
      && !refreshed.reused
      && refreshed.runStatus === "SUCCEEDED"
    ) {
      checkedAt = new Date().toISOString();
    }
  }

  const readTimed = await measureMs(() =>
    readSynaravaStateForCompare(input.scope, {
      adminUsername: input.requestedBy,
      checkedAt,
    }),
  );
  const compareTimed = measureSyncCompare(readTimed.value);
  emitWaterfallTiming({
    scope: input.scope,
    trigger: input.skipRefresh ? null : (input.trigger ?? "MANUAL"),
    totalMs: Math.round(performance.now() - totalStarted),
    compareReadMs: readTimed.ms,
    compareCpuMs: compareTimed.ms,
    timing: refreshTiming,
    status,
    warningCount: refreshTiming?.warningCount ?? (warning ? 1 : 0),
  });
  return { result: compareTimed.value, warning };
}

function measureSyncCompare(compareInput: Parameters<typeof compareSyncState>[0]) {
  const started = performance.now();
  const value = compareSyncState(compareInput);
  return { value, ms: Math.round(performance.now() - started) };
}
