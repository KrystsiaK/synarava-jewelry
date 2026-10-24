/**
 * Every sync action runs this loop:
 * 1. Fetch full Shopify state
 * 2. Read our Synarava state
 * 3. Compare in ONE function
 * 4. Return SyncResult for selectSyncCounts / UI render
 */

import "server-only";

import { compareSyncState } from "./compare";
import { readSynaravaStateForCompare } from "./read-synarava-state";
import {
  refreshShopifyState,
  type RefreshShopifyStateScope,
} from "./refresh-shopify-state";
import type { SyncResult } from "./types";

export type SyncWaterfallResult = {
  result: SyncResult;
  warning?: string;
};

/**
 * Waterfall entry — admin load, post-Save, post-Apply, and Check all call this.
 * After any human Apply leaf, callers must invoke again.
 */
export async function runSyncWaterfall(input: {
  scope: RefreshShopifyStateScope;
  requestedBy: string;
  /** Skip network refresh (e.g. layout badge from already-persisted state). */
  skipRefresh?: boolean;
  /** Top-bar AUTO/MANUAL; forwarded to catalog refresh translation run. */
  trigger?: "AUTO" | "MANUAL";
}): Promise<SyncWaterfallResult> {
  let warning: string | undefined;
  let checkedAt: string | null | undefined;

  if (!input.skipRefresh) {
    const refreshed = await refreshShopifyState(input.scope, input.requestedBy, {
      trigger: input.trigger,
    });
    warning = refreshed.warning;
    checkedAt = new Date().toISOString();
  }

  const compareInput = await readSynaravaStateForCompare(input.scope, {
    adminUsername: input.requestedBy,
    checkedAt,
  });
  const result = compareSyncState(compareInput);
  return { result, warning };
}
