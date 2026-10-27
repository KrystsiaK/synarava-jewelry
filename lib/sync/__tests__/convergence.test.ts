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

import { verifyConvergenceAfterWrite } from "@/lib/sync/convergence";

function leaf(overrides: Partial<{
  fieldKey: string;
  label: string;
  resourceId: string;
  resourceType: "PRODUCT" | "COLLECTION";
  locale: string | null;
}> = {}) {
  return {
    id: "1",
    resourceType: overrides.resourceType ?? "PRODUCT",
    resourceId: overrides.resourceId ?? "p1",
    kind: "commerce" as const,
    locale: overrides.locale ?? null,
    fieldKey: overrides.fieldKey ?? "commerce:vendor",
    label: overrides.label ?? "Vendor",
    synaravaValue: "a",
    shopifyValue: "b",
    allowedDirections: [] as const,
    blockedReason: null,
    sourceId: null,
    path: "vendor",
    node: "base" as const,
  };
}

describe("verifyConvergenceAfterWrite (PR-8)", () => {
  beforeEach(() => {
    recheck.mockReset();
  });

  it("converged when intended leaf is gone", async () => {
    recheck.mockResolvedValueOnce({ leaves: [] });
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "test",
      intended: [{
        entityType: "PRODUCT",
        entityId: "p1",
        node: "base",
        fieldKey: "commerce:vendor",
        label: "Vendor",
      }],
    });
    expect(result.status).toBe("converged");
  });

  it("did not converge when Shopify still differs", async () => {
    recheck.mockResolvedValueOnce({ leaves: [leaf()] });
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "test",
      intended: [{
        entityType: "PRODUCT",
        entityId: "p1",
        node: "base",
        fieldKey: "commerce:vendor",
        label: "Vendor",
      }],
    });
    expect(result).toMatchObject({
      status: "did_not_converge",
      remainingLabels: ["Vendor"],
    });
  });

  it("convergence_unverified when refresh throws", async () => {
    recheck.mockRejectedValueOnce(new Error("refresh hung / threw"));
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "test",
      intended: [{
        entityType: "PRODUCT",
        entityId: "p1",
        node: "base",
        fieldKey: "commerce:vendor",
        label: "Vendor",
      }],
    });
    expect(result.status).toBe("convergence_unverified");
  });

  it("reports unrelated new leaves separately when intended cleared", async () => {
    recheck.mockResolvedValueOnce({
      leaves: [leaf({ fieldKey: "commerce:tags", label: "Tags" })],
    });
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "test",
      intended: [{
        entityType: "PRODUCT",
        entityId: "p1",
        node: "base",
        fieldKey: "commerce:vendor",
        label: "Vendor",
      }],
    });
    expect(result.status).toBe("unrelated_new_leaves");
  });
});
