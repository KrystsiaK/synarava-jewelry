import type { CatalogAuditRequest } from "@synarava/sku-contract";
import { createHash } from "node:crypto";
import type {
  AssignmentRecord,
  LegacyImportRow,
  SkuRegistryStore,
} from "./registry/types.js";

export type LegacyBackfillConflict = {
  readonly code:
    | "INPUT_VARIANT_CONFLICT"
    | "INPUT_SKU_CONFLICT"
    | "VARIANT_ALREADY_ASSIGNED"
    | "SKU_ALREADY_ASSIGNED";
  readonly externalVariantId: string;
  readonly sku: string;
  readonly existingAssignmentId: string | null;
};

export type LegacyBackfillPlan = {
  readonly itemCount: number;
  readonly nonEmptyItemCount: number;
  readonly createCount: number;
  readonly existingCount: number;
  readonly conflictCount: number;
  readonly digest: string;
  readonly rows: readonly LegacyImportRow[];
  readonly conflicts: readonly LegacyBackfillConflict[];
};

type BackfillInput = {
  readonly store: SkuRegistryStore;
  readonly workspaceKey: string;
  readonly items: ReadonlyArray<CatalogAuditRequest["items"][number]>;
};

function digestItems(
  items: ReadonlyArray<CatalogAuditRequest["items"][number]>,
): string {
  return createHash("sha256").update(JSON.stringify(items)).digest("hex");
}

export async function planLegacyBackfill(
  input: BackfillInput,
): Promise<LegacyBackfillPlan> {
  const catalog = input.items
    .filter((item) => item.sku.trim().length > 0)
    .map((item) => ({
      externalVariantId: item.externalVariantId,
      sku: item.sku,
    }))
    .toSorted((a, b) =>
      a.externalVariantId.localeCompare(b.externalVariantId) ||
      a.sku.localeCompare(b.sku),
    );
  const assignments = await input.store.listAssignments(input.workspaceKey);
  const byVariant = new Map(
    assignments
      .filter((assignment) => assignment.externalVariantId)
      .map((assignment) => [assignment.externalVariantId!, assignment]),
  );
  const bySku = new Map(assignments.map((assignment) => [assignment.sku, assignment]));
  const inputByVariant = new Map<string, string>();
  const inputBySku = new Map<string, string>();
  const rows: LegacyImportRow[] = [];
  const conflicts: LegacyBackfillConflict[] = [];
  let existingCount = 0;

  for (const item of catalog) {
    const earlierSku = inputByVariant.get(item.externalVariantId);
    if (earlierSku !== undefined) {
      if (earlierSku !== item.sku) {
        conflicts.push({
          code: "INPUT_VARIANT_CONFLICT",
          ...item,
          existingAssignmentId: null,
        });
      }
      continue;
    }
    inputByVariant.set(item.externalVariantId, item.sku);

    const earlierVariant = inputBySku.get(item.sku);
    if (earlierVariant !== undefined && earlierVariant !== item.externalVariantId) {
      conflicts.push({
        code: "INPUT_SKU_CONFLICT",
        ...item,
        existingAssignmentId: null,
      });
      continue;
    }
    inputBySku.set(item.sku, item.externalVariantId);

    const variantAssignment = byVariant.get(item.externalVariantId);
    if (variantAssignment) {
      if (variantAssignment.sku === item.sku) {
        existingCount += 1;
      } else {
        conflicts.push({
          code: "VARIANT_ALREADY_ASSIGNED",
          ...item,
          existingAssignmentId: variantAssignment.id,
        });
      }
      continue;
    }

    const skuAssignment = bySku.get(item.sku);
    if (skuAssignment) {
      if (skuAssignment.externalVariantId === item.externalVariantId) {
        existingCount += 1;
      } else {
        conflicts.push({
          code: "SKU_ALREADY_ASSIGNED",
          ...item,
          existingAssignmentId: skuAssignment.id,
        });
      }
      continue;
    }

    rows.push({
      sku: item.sku,
      externalSystem: "shopify",
      externalVariantId: item.externalVariantId,
    });
  }

  return {
    itemCount: input.items.length,
    nonEmptyItemCount: catalog.length,
    createCount: rows.length,
    existingCount,
    conflictCount: conflicts.length,
    digest: digestItems(catalog),
    rows,
    conflicts,
  };
}

export async function applyLegacyBackfill(
  input: BackfillInput & {
    readonly expectedDigest: string;
    readonly correlationId: string;
    readonly actor: string;
  },
): Promise<{
  readonly plan: LegacyBackfillPlan;
  readonly created: number;
  readonly skipped: number;
  readonly assignments: readonly AssignmentRecord[];
}> {
  const plan = await planLegacyBackfill(input);
  if (plan.digest !== input.expectedDigest) {
    throw new Error("legacy backfill digest does not match reviewed dry-run");
  }
  if (plan.conflictCount > 0) {
    throw new Error("legacy backfill has unresolved conflicts");
  }
  const imported = await input.store.importLegacyAssignments(
    input.workspaceKey,
    plan.rows,
    input.correlationId,
    input.actor,
  );
  return {
    plan,
    created: imported.created,
    skipped: plan.existingCount + imported.skipped,
    assignments: imported.assignments,
  };
}
