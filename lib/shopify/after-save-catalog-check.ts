import "server-only";

import {
  runSyncWaterfall,
  type RefreshShopifyStateScope,
} from "@/lib/sync";

export type AfterSaveCatalogCheckResult = {
  alreadyRunning: boolean;
  ok: boolean;
  warning?: string;
};

/**
 * Shared post-action helper: after Synarava DB write / Apply / Push / Pull /
 * SKU assign succeeds, refresh+compare ONLY the given entity scope.
 *
 * Full-store refresh stays on the top-bar Manual click and once-per-login Auto.
 * Callers must pass product or collection entity scope — never the store-wide
 * refresh kind.
 *
 * - Never throws — a failed check must not fail the save/apply.
 * - If another check holds the single-flight lease, return `{ alreadyRunning: true }`
 *   honestly. Never schedule a second full or scoped follow-up run.
 */
export async function runAfterSaveCatalogConflictCheck(
  requestedBy: string,
  scope: RefreshShopifyStateScope,
): Promise<AfterSaveCatalogCheckResult> {
  try {
    const checked = await runSyncWaterfall({ scope, requestedBy });
    if (checked.alreadyRunning) {
      return {
        alreadyRunning: true,
        ok: true,
        warning: checked.warning ?? "already running",
      };
    }
    return {
      alreadyRunning: false,
      ok: true,
      warning: checked.warning,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[after-save-catalog-check] scoped conflict check failed", message);
    return { alreadyRunning: false, ok: false, warning: message };
  }
}
