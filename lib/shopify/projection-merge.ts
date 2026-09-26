/**
 * Three-way merge classification for Shopify-shaped projections (B / L / R).
 * Detection stays object+path based — no commerce field allowlists.
 *
 * @see docs/admin/commerce-sync.md
 */

import { isDeepStrictEqual } from "node:util";

import {
  canonicalizeShopifyProjection,
  diffShopifyProjections,
  getProjectionPath,
  type ShopifyProjectionDiff,
} from "@/lib/shopify/shopify-projection-diff";

export type PathMergeKind = "synced" | "ahead" | "remote" | "conflict";

export type ProjectionPathDifference = ShopifyProjectionDiff & {
  kind: Exclude<PathMergeKind, "synced">;
};

export type ProjectionMergeState =
  | "SYNCED"
  | "LOCAL_CHANGES"
  | "REMOTE_CHANGES"
  | "CONFLICT";

export type ClassifyProjectionMergeInput = {
  base: unknown;
  local: unknown;
  remote: unknown;
  /**
   * When stored base is null and the product is already dirty (PENDING/FAILED/CONFLICT),
   * L≠R cannot be attributed — classify as conflict (conservative, matches pre-base behavior).
   */
  dirtyWithoutBase?: boolean;
};

export type ClassifyProjectionMergeResult = {
  state: ProjectionMergeState;
  differences: ProjectionPathDifference[];
  /** Canonical base used for classification (invented as L when backfilling). */
  effectiveBase: unknown;
  /** Persist this as shopifyBaseSnapshot when true. */
  shouldPersistBase: boolean;
};

function eq(left: unknown, right: unknown): boolean {
  return isDeepStrictEqual(
    canonicalizeShopifyProjection(left ?? null),
    canonicalizeShopifyProjection(right ?? null),
  );
}

export function statusAtPath(
  base: unknown,
  local: unknown,
  remote: unknown,
): PathMergeKind {
  if (eq(local, remote)) return "synced";
  if (eq(base, local)) return "remote";
  if (eq(base, remote)) return "ahead";
  return "conflict";
}

/**
 * Classify L↔R leaf diffs using B. Aggregate product inspection state.
 */
export function classifyProjectionMerge(
  input: ClassifyProjectionMergeInput,
): ClassifyProjectionMergeResult {
  const local = canonicalizeShopifyProjection(input.local ?? {});
  const remote = canonicalizeShopifyProjection(input.remote ?? {});
  const hasStoredBase = input.base != null;
  const dirtyWithoutBase = Boolean(input.dirtyWithoutBase) && !hasStoredBase;

  let effectiveBase: unknown;
  let shouldPersistBase = false;

  if (hasStoredBase) {
    effectiveBase = canonicalizeShopifyProjection(input.base);
  } else if (dirtyWithoutBase) {
    effectiveBase = null;
  } else {
    // Honest start without history: assume B := L (remote-only diffs, not false conflicts).
    effectiveBase = local;
    shouldPersistBase = true;
  }

  const lrDiffs = diffShopifyProjections(local, remote);
  const differences: ProjectionPathDifference[] = [];

  for (const diff of lrDiffs) {
    const path = diff.path;
    const lVal = getProjectionPath(local, path);
    const rVal = getProjectionPath(remote, path);

    let kind: Exclude<PathMergeKind, "synced">;
    if (effectiveBase == null) {
      kind = "conflict";
    } else {
      const bVal = getProjectionPath(effectiveBase, path);
      const status = statusAtPath(bVal, lVal, rVal);
      if (status === "synced") continue;
      kind = status;
    }

    differences.push({ ...diff, kind });
  }

  const hasConflict = differences.some((item) => item.kind === "conflict");
  const hasAhead = differences.some((item) => item.kind === "ahead");
  const hasRemote = differences.some((item) => item.kind === "remote");

  // Path kinds stay precise; product aggregate treats simultaneous ahead+remote
  // like the old localChanged&&remoteChanged → CONFLICT (needs a decision / sync).
  const state: ProjectionMergeState = hasConflict || (hasAhead && hasRemote)
    ? "CONFLICT"
    : hasAhead
      ? "LOCAL_CHANGES"
      : hasRemote
        ? "REMOTE_CHANGES"
        : "SYNCED";

  // Repair invariant L = R ⇒ B = L when we already have a stored base that drifted.
  if (state === "SYNCED" && hasStoredBase && !eq(effectiveBase, local)) {
    effectiveBase = local;
    shouldPersistBase = true;
  }

  return {
    state,
    differences,
    effectiveBase: effectiveBase ?? local,
    shouldPersistBase,
  };
}
