/**
 * Thin gate: after a human Apply write, fail the action when the intended
 * conflict leaf remains (or refresh cannot verify). Reuses the single
 * verifyConvergenceAfterWrite — no second compare path.
 */

import "server-only";

import {
  convergenceApplyOutcome,
  verifyConvergenceAfterWrite,
  type IntendedConflictAddress,
} from "./convergence";
import type { RecheckEntityConflictLeavesInput } from "./recheck-entity-leaves";
import type { SyncLeaf } from "./types";

export async function gateWriteConvergence(input: {
  resourceType: RecheckEntityConflictLeavesInput["resourceType"];
  resourceId: string;
  requestedBy: string;
  leavesBefore: readonly SyncLeaf[];
  intended: readonly IntendedConflictAddress[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.intended.length === 0) return { ok: true };
  const result = await verifyConvergenceAfterWrite({
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requestedBy: input.requestedBy,
    intended: input.intended,
    leavesBefore: input.leavesBefore,
  });
  const outcome = convergenceApplyOutcome(result);
  if (outcome.status === "resolved") return { ok: true };
  if (outcome.status === "still-conflicting") {
    return {
      ok: false,
      message: `The write went through, but ${outcome.message}. Nothing is marked resolved — try again.`,
    };
  }
  return { ok: false, message: outcome.message };
}
