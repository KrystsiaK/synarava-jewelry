/**
 * PR-8 / STEP 7 — Convergence postcondition after a write batch.
 * Exactly ONE scoped entity waterfall via recheckEntityConflictLeaves.
 * Scoped runs never replace full-catalog checkedAt/counters (waterfall already scopes).
 */

import "server-only";

import {
  recheckEntityConflictLeaves,
  type RecheckEntityConflictLeavesInput,
} from "./recheck-entity-leaves";
import type { SyncConflictAddress } from "./select";
import { conflictAddress } from "./select";
import type { SyncLeaf } from "./types";

export type IntendedConflictAddress = SyncConflictAddress & {
  /** Human label for "did not converge: …" messages. */
  label?: string | null;
};

export type ConvergenceStatus =
  | { status: "converged" }
  | {
      status: "did_not_converge";
      remainingLabels: string[];
      remainingLeaves: readonly SyncLeaf[];
    }
  | {
      status: "convergence_unverified";
      message: string;
    }
  | {
      status: "unrelated_new_leaves";
      /** Intended addresses converged; these leaves were absent before the write. */
      newLeaves: readonly SyncLeaf[];
    };

function addressKey(address: Pick<IntendedConflictAddress, "entityType" | "entityId" | "node" | "fieldKey">): string {
  return `${address.entityType}:${address.entityId}:${address.node}:${address.fieldKey}`;
}

/** Match intended leaf by fieldKey only — label can churn (e.g. Product data (N fields)). */
function findLeafByFieldKey(
  leaves: readonly SyncLeaf[],
  fieldKey: string | null | undefined,
): SyncLeaf | undefined {
  const key = fieldKey?.trim();
  if (!key) return undefined;
  return leaves.find((leaf) => leaf.fieldKey === key);
}

/**
 * After a write batch: refresh Shopify → read Synarava → compareSyncState once.
 * Intended leaves must be gone. Unrelated new leaves are only those that were
 * **absent** before the write (pass `leavesBefore`) — pre-existing siblings
 * are not "new".
 */
export async function verifyConvergenceAfterWrite(input: {
  resourceType: RecheckEntityConflictLeavesInput["resourceType"];
  resourceId: string;
  requestedBy: string;
  /** Conflict addresses that the write was meant to clear. */
  intended: readonly IntendedConflictAddress[];
  /**
   * Leaves observed immediately before the write (same entity). Required for
   * honest `unrelated_new_leaves` — without it, every pre-existing sibling
   * looks "new".
   */
  leavesBefore: readonly SyncLeaf[];
}): Promise<ConvergenceStatus> {
  let leaves: readonly SyncLeaf[];
  try {
    ({ leaves } = await recheckEntityConflictLeaves({
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      requestedBy: input.requestedBy,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Post-write recheck failed.";
    return {
      status: "convergence_unverified",
      message: /was not found|no longer exists/i.test(message)
        ? "The linked Shopify resource no longer exists — write could not be verified. Nothing is marked resolved."
        : /not linked/i.test(message)
          ? "This resource is no longer linked to Shopify — write could not be verified. Nothing is marked resolved."
          : message,
    };
  }

  const intendedKeys = new Set(input.intended.map(addressKey));
  const beforeKeys = new Set(
    input.leavesBefore.map((leaf) => addressKey(conflictAddress(leaf))),
  );
  const remaining: SyncLeaf[] = [];
  const remainingLabels: string[] = [];

  for (const intended of input.intended) {
    const leaf = findLeafByFieldKey(leaves, intended.fieldKey);
    if (!leaf) continue;
    remaining.push(leaf);
    remainingLabels.push(intended.label?.trim() || leaf.label);
  }

  if (remaining.length > 0) {
    return {
      status: "did_not_converge",
      remainingLabels: [...new Set(remainingLabels)],
      remainingLeaves: remaining,
    };
  }

  const newLeaves = leaves.filter((leaf) => {
    const key = addressKey(conflictAddress(leaf));
    if (intendedKeys.has(key)) return false;
    if (beforeKeys.has(key)) return false;
    return true;
  });
  if (newLeaves.length > 0 && input.intended.length > 0) {
    return { status: "unrelated_new_leaves", newLeaves };
  }

  return { status: "converged" };
}

/** Build an intended address from a SyncLeaf about to be applied. */
export function intendedAddressFromLeaf(leaf: SyncLeaf): IntendedConflictAddress {
  return {
    ...conflictAddress(leaf),
    label: leaf.label,
  };
}

/**
 * Map convergence status to Apply outcome. Intended clear = success even when
 * truly-new unrelated leaves appeared (reported separately via status).
 */
export function convergenceApplyOutcome(
  result: ConvergenceStatus,
):
  | { status: "resolved" }
  | { status: "still-conflicting"; message: string }
  | { status: "unverifiable"; message: string } {
  if (result.status === "converged" || result.status === "unrelated_new_leaves") {
    return { status: "resolved" };
  }
  if (result.status === "did_not_converge") {
    return {
      status: "still-conflicting",
      message: `did not converge: ${result.remainingLabels.join(", ")}`,
    };
  }
  return { status: "unverifiable", message: result.message };
}
