import "server-only";

import { after } from "next/server";

import { runCatalogConflictCheck } from "@/lib/shopify/catalog-conflict-signals-server";

export type AfterSaveCatalogCheckResult = {
  alreadyRunning: boolean;
  ok: boolean;
  warning?: string;
};

/**
 * Shared post-save helper: after Synarava DB save succeeds, run the SAME
 * full catalog check the top-bar button runs (`runCatalogConflictCheck`).
 *
 * - Never throws — a failed check must not fail the save.
 * - If another check is already running, return immediately with
 *   `alreadyRunning: true` (UI shows top-bar status). Optionally schedule a
 *   single non-blocking follow-up via `after()` so the edit is picked up
 *   without holding the server action for up to 11 minutes.
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

    // Audit #6: do not poll for up to 11 minutes inside the save action.
    // Non-blocking follow-up only — never awaits the active run.
    after(() => {
      void runCatalogConflictCheck(requestedBy, { trigger: "MANUAL" }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[after-save-catalog-check] non-blocking follow-up failed", message);
      });
    });

    return {
      alreadyRunning: true,
      ok: true,
      warning: checked.warning ?? "already running",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[after-save-catalog-check] full catalog check failed", message);
    return { alreadyRunning: false, ok: false, warning: message };
  }
}
