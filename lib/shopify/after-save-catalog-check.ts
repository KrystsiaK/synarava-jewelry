import "server-only";

import { runCatalogConflictCheck } from "@/lib/shopify/catalog-conflict-signals-server";
import { getLatestReconcileRun } from "@/lib/shopify/reconciliation-run";

export type AfterSaveCatalogCheckResult = {
  alreadyRunning: boolean;
  ok: boolean;
  warning?: string;
};

const FOLLOW_UP_POLL_MS = 1500;
const FOLLOW_UP_TIMEOUT_MS = 11 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForActiveCatalogRunToFinish(): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < FOLLOW_UP_TIMEOUT_MS) {
    const run = await getLatestReconcileRun();
    if (!run || (run.status !== "QUEUED" && run.status !== "RUNNING")) return;
    await sleep(FOLLOW_UP_POLL_MS);
  }
}

/**
 * Shared post-save helper: after Synarava DB save succeeds, await the SAME
 * full catalog check the top-bar button runs (`runCatalogConflictCheck`).
 *
 * - Synchronous for the save action (caller must await).
 * - Never throws — a failed check must not fail the save.
 * - If another check is already running, wait for it once, then re-run (single
 *   follow-up, not a queue).
 */
export async function runAfterSaveCatalogConflictCheck(
  requestedBy: string,
): Promise<AfterSaveCatalogCheckResult> {
  try {
    const checked = await runCatalogConflictCheck(requestedBy, { trigger: "MANUAL" });
    if (!checked.alreadyRunning) {
      return {
        alreadyRunning: false,
        ok: true,
        warning: checked.warning,
      };
    }

    await waitForActiveCatalogRunToFinish();
    const followUp = await runCatalogConflictCheck(requestedBy, { trigger: "MANUAL" });
    if (followUp.alreadyRunning) {
      return {
        alreadyRunning: true,
        ok: true,
        warning: followUp.warning ?? "already running",
      };
    }
    return {
      alreadyRunning: false,
      ok: true,
      warning: followUp.warning,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[after-save-catalog-check] full catalog check failed", message);
    return { alreadyRunning: false, ok: false, warning: message };
  }
}
