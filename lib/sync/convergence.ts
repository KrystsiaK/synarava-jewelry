/**
 * PR-8 — Convergence postcondition after a write batch.
 * Exactly ONE scoped entity waterfall via recheckEntityConflictLeaves.
 * Scoped runs never replace full-catalog checkedAt/counters (waterfall already scopes).
 */

import "server-only";

import {
  findConflictLeaf,
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
      /** Intended addresses converged, but other leaves appeared. */
      newLeaves: readonly SyncLeaf[];
    };

function addressKey(address: Pick<IntendedConflictAddress, "entityType" | "entityId" | "node" | "fieldKey">): string {
  return `${address.entityType}:${address.entityId}:${address.node}:${address.fieldKey}`;
}

/**
 * After a write batch: refresh Shopify → read Synarava → compareSyncState once.
 * Intended leaves must be gone. Unrelated new leaves are reported separately —
 * never counted as success for the intended set, and never as a silent pass.
 */
export async function verifyConvergenceAfterWrite(input: {
  resourceType: RecheckEntityConflictLeavesInput["resourceType"];
  resourceId: string;
  requestedBy: string;
  /** Conflict addresses that the write was meant to clear. */
  intended: readonly IntendedConflictAddress[];
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
  const remaining: SyncLeaf[] = [];
  const remainingLabels: string[] = [];

  for (const intended of input.intended) {
    const leaf = findConflictLeaf(leaves, {
      fieldKey: intended.fieldKey,
      label: intended.label,
    });
    if (!leaf) continue;
    // Whole-item / media: treat still-open matching leaf as not converged.
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

  const newLeaves = leaves.filter((leaf) => !intendedKeys.has(addressKey(conflictAddress(leaf))));
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
