import { describe, expect, it } from "vitest";

import {
  signalState,
  syncSignalDetail,
} from "@/components/admin/translations/admin-shopify-sync-signal";
import type { ReconcileRunSummary } from "@/lib/shopify/reconciliation-run";
import { shopRegistryLocalesMissingWarning } from "@/lib/shopify/shop-locale-write-gate";

function run(overrides: Partial<ReconcileRunSummary> = {}): ReconcileRunSummary {
  return {
    id: "run-1",
    trigger: "AUTO",
    status: "SUCCEEDED",
    checkedCount: 1,
    differenceCount: 0,
    error: null,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:01:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    ...overrides,
  };
}

const languagesWarning = shopRegistryLocalesMissingWarning({
  shopDomain: "example.myshopify.com",
  shopLocales: ["en", "ru"],
  missingRegistryLocales: ["pt-PT"],
});

describe("AdminShopifySyncSignal state priority", () => {
  it("treats requestError as failed even when run is null (errored first AUTO)", () => {
    expect(signalState(null, true, "network down").kind).toBe("failed");
  });

  it("does not show checking when requestError is set alongside a stale run", () => {
    expect(signalState(run({ status: "RUNNING" }), true, "poll failed").kind).toBe("failed");
  });

  it("keeps PARTIAL/FAILED as failed (top bar red) and surfaces run.error", () => {
    const partial = run({
      status: "PARTIAL",
      error: "1 check could not be completed. product-1 (ru): Shopify Admin API 429: throttled",
    });
    const state = signalState(partial, true, null);
    expect(state).toEqual({ kind: "failed", label: "Check failed" });
    expect(syncSignalDetail(partial, null, state.kind)).toBe(partial.error);

    const failed = run({ status: "FAILED", error: "Shopify connection is not configured." });
    expect(signalState(failed, true, null).kind).toBe("failed");
    expect(syncSignalDetail(failed, null, "failed")).toBe(failed.error);
  });

  it("shows yellow Languages missing in Shopify when SUCCEEDED with registry-missing warning", () => {
    const missing = run({ status: "SUCCEEDED", error: languagesWarning });
    const state = signalState(missing, true, null);
    expect(state).toEqual({
      kind: "languages-missing",
      label: "Languages missing in Shopify",
    });
    expect(syncSignalDetail(missing, null, state.kind)).toBe(languagesWarning);
  });

  it("does not treat API failure text as languages-missing even if warning substring appears", () => {
    const mixed = run({
      status: "PARTIAL",
      error: `1 check could not be completed. product-1 (ru): boom. ${languagesWarning}`,
    });
    expect(signalState(mixed, true, null).kind).toBe("failed");
  });
});
