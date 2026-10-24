import "server-only";

import { runCatalogConflictCheck } from "@/lib/shopify/catalog-conflict-signals-server";

export type AfterSaveCatalogCheckResult = {
  alreadyRunning: boolean;
  ok: boolean;
  warning?: string;
};

/**
 * Shared post-save helper: after Synarava DB save succeeds, await the SAME
 * full catalog check the top-bar button runs (`runCatalogConflictCheck`).
 *
 * - Synchronous for the save action (caller must await).
 * - Never throws — a failed check must not fail the save.
 * - Single-flight lives inside the check (already_running is not an error).
 */
export async function runAfterSaveCatalogConflictCheck(
  requestedBy: string,
): Promise<AfterSaveCatalogCheckResult> {
  try {
    const checked = await runCatalogConflictCheck(requestedBy, { trigger: "MANUAL" });
    if (checked.alreadyRunning) {
      return { alreadyRunning: true, ok: true, warning: "already running" };
    }
    return {
      alreadyRunning: false,
      ok: true,
      warning: checked.warning,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[after-save-catalog-check] full catalog check failed", message);
    return { alreadyRunning: false, ok: false, warning: message };
  }
}
