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

const intendedVendor = {
  entityType: "PRODUCT" as const,
  entityId: "p1",
  node: "base" as const,
  fieldKey: "commerce:vendor",
  label: "Vendor",
};

describe("verifyConvergenceAfterWrite (STEP 7)", () => {
  beforeEach(() => {
    recheck.mockReset();
  });

  it("converged when intended leaf is gone", async () => {
    recheck.mockResolvedValueOnce({ leaves: [] });
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "test",
      intended: [intendedVendor],
      leavesBefore: [leaf()],
    });
    expect(result.status).toBe("converged");
  });

  it("did not converge when Shopify still differs (fieldKey match only)", async () => {
    recheck.mockResolvedValueOnce({
      leaves: [leaf({ label: "Product data (9 fields)" })],
    });
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "test",
      intended: [intendedVendor],
      leavesBefore: [leaf()],
    });
    expect(result).toMatchObject({
      status: "did_not_converge",
      remainingLabels: ["Vendor"],
    });
  });

  it("does not match remaining leaf by label alone when fieldKey differs", async () => {
    const sibling = leaf({ fieldKey: "commerce:tags", label: "Vendor" });
    recheck.mockResolvedValueOnce({ leaves: [sibling] });
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "test",
      intended: [intendedVendor],
      leavesBefore: [leaf(), sibling],
    });
    // Pre-existing Tags sibling with a colliding label is not the intended Vendor leaf.
    expect(result.status).toBe("converged");
  });

  it("convergence_unverified when refresh throws", async () => {
    recheck.mockRejectedValueOnce(new Error("refresh hung / threw"));
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "test",
      intended: [intendedVendor],
      leavesBefore: [leaf()],
    });
    expect(result.status).toBe("convergence_unverified");
  });

  it("pre-existing unrelated siblings are not unrelated_new_leaves", async () => {
    const sibling = leaf({ fieldKey: "commerce:tags", label: "Tags" });
    recheck.mockResolvedValueOnce({ leaves: [sibling] });
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "test",
      intended: [intendedVendor],
      leavesBefore: [leaf(), sibling],
    });
    expect(result.status).toBe("converged");
  });

  it("reports truly new unrelated leaves when intended cleared", async () => {
    const newborn = leaf({ fieldKey: "commerce:tags", label: "Tags" });
    recheck.mockResolvedValueOnce({ leaves: [newborn] });
    const result = await verifyConvergenceAfterWrite({
      resourceType: "PRODUCT",
      resourceId: "p1",
      requestedBy: "test",
      intended: [intendedVendor],
      leavesBefore: [leaf()],
    });
    expect(result.status).toBe("unrelated_new_leaves");
    if (result.status === "unrelated_new_leaves") {
      expect(result.newLeaves.map((item) => item.fieldKey)).toEqual(["commerce:tags"]);
    }
  });
});
