/**
 * Phase 1 — convergence gate must never report success while the intended leaf remains.
 * Findings: docs/audits/2026-10-28-sync-adversarial.md
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const recheck = vi.fn();

vi.mock("@/lib/sync/recheck-entity-leaves", () => ({
  recheckEntityConflictLeaves: (...args: unknown[]) => recheck(...args),
  findConflictLeaf: (
    leaves: Array<{ fieldKey: string; label: string }>,
    match: { fieldKey?: string | null; label?: string | null },
  ) => {
    if (match.fieldKey) {
      const byKey = leaves.find((leaf) => leaf.fieldKey === match.fieldKey);
      if (byKey) return byKey;
    }
    if (match.label) return leaves.find((leaf) => leaf.label === match.label);
    return undefined;
  },
}));

import {
  convergenceApplyOutcome,
  verifyConvergenceAfterWrite,
} from "@/lib/sync/convergence";
import { gateWriteConvergence } from "@/lib/sync/gate-write-convergence";
import type { SyncLeaf } from "@/lib/sync/types";

function leaf(overrides: Partial<SyncLeaf> = {}): SyncLeaf {
  return {
    id: "1",
    resourceType: "PRODUCT",
    resourceId: "p1",
    kind: "commerce",
    locale: null,
    fieldKey: "commerce:vendor",
    label: "Vendor",
    synaravaValue: "a",
    shopifyValue: "b",
    allowedDirections: [],
    blockedReason: null,
    sourceId: null,
    path: "vendor",
    contractKey: "vendor",
    section: "essentials",
    node: "base",
    ...overrides,
  };
}

const intended = {
  entityType: "PRODUCT" as const,
  entityId: "p1",
  node: "base" as const,
  fieldKey: "commerce:vendor",
  label: "Vendor",
};

describe("adversarial: convergence never succeeds while intended leaf remains", () => {
  beforeEach(() => {
    recheck.mockReset();
  });

  it("verifyConvergenceAfterWrite → did_not_converge when intended fieldKey still present", async () => {
    recheck.mockResolvedValueOnce({ leaves: [leaf()] });
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "audit",
      intended: [intended],
      leavesBefore: [leaf()],
    });
    expect(result.status).toBe("did_not_converge");
    expect(convergenceApplyOutcome(result).status).toBe("still-conflicting");
  });

  it("gateWriteConvergence returns ok:false when intended leaf remains", async () => {
    recheck.mockResolvedValueOnce({ leaves: [leaf()] });
    const gated = await gateWriteConvergence({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "audit",
      intended: [intended],
      leavesBefore: [leaf()],
    });
    expect(gated.ok).toBe(false);
    if (gated.ok) throw new Error("expected failure");
    expect(gated.message).toMatch(/still|conflict|try again/i);
  });

  it("label-only collision does not clear an intended fieldKey that remains", async () => {
    // Remaining leaf keeps the intended fieldKey even if label text changed.
    recheck.mockResolvedValueOnce({
      leaves: [leaf({ label: "Product data (9 fields)" })],
    });
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "audit",
      intended: [intended],
      leavesBefore: [leaf()],
    });
    expect(result.status).toBe("did_not_converge");
    expect(convergenceApplyOutcome(result).status).not.toBe("resolved");
  });

  it("empty intended is a no-op success (explicit Push without fingerprint intent)", async () => {
    const gated = await gateWriteConvergence({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "audit",
      intended: [],
      leavesBefore: [leaf()],
    });
    expect(gated).toEqual({ ok: true });
    expect(recheck).not.toHaveBeenCalled();
  });
});
