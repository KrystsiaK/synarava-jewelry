import { describe, expect, it } from "vitest";

/**
 * Audit #4: requestError must win over !run "checking", and a failed first
 * AUTO must stay retryable.
 */

function signalState(
  run: { status: string } | null,
  connected: boolean,
  requestError: string | null,
): "checking" | "current" | "failed" | "disconnected" {
  if (!connected) return "disconnected";
  if (requestError || run?.status === "FAILED" || run?.status === "PARTIAL") return "failed";
  if (!run || run.status === "QUEUED" || run.status === "RUNNING") return "checking";
  return "current";
}

describe("AdminShopifySyncSignal state priority", () => {
  it("treats requestError as failed even when run is null (errored first AUTO)", () => {
    expect(signalState(null, true, "network down")).toBe("failed");
  });

  it("does not show checking when requestError is set alongside a stale run", () => {
    expect(signalState({ status: "RUNNING" }, true, "poll failed")).toBe("failed");
  });

  it("keeps PARTIAL/FAILED as failed (top bar red)", () => {
    expect(signalState({ status: "PARTIAL" }, true, null)).toBe("failed");
    expect(signalState({ status: "FAILED" }, true, null)).toBe("failed");
  });
});
