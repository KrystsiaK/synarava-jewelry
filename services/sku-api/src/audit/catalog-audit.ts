import { createHash } from "node:crypto";
import {
  fail,
  validateSkuFormat,
  type PolicyProfileConfig,
} from "@synarava/sku-core";
import { domainError } from "../registry/errors.js";
import type { AssignmentRecord, SkuRegistryStore } from "../registry/types.js";

/** Bounded batch size for audit clients (proposal §10). */
export const CATALOG_AUDIT_MAX_BATCH = 100;

export type CatalogAuditDeviationCode =
  | "MISSING_ASSIGNMENT"
  | "SKU_MISMATCH"
  | "EXTERNAL_EMPTY"
  | "INVALID_FORMAT";

export type CatalogAuditItemInput = {
  readonly externalVariantId: string;
  readonly sku: string;
};

export type CatalogAuditDeviation = {
  readonly externalVariantId: string;
  readonly codes: readonly CatalogAuditDeviationCode[];
  readonly observedSku: string;
  readonly ledgerSku: string | null;
  readonly assignmentId: string | null;
};

export type CatalogAuditResult = {
  readonly ok: true;
  readonly itemCount: number;
  readonly deviationCount: number;
  readonly deviations: readonly CatalogAuditDeviation[];
  readonly digest: string;
  readonly shouldNotify: boolean;
  readonly durationMs: number;
  readonly llmEnabled: false;
  readonly correlationId: string;
};

function emptyDigest(): string {
  return createHash("sha256").update("catalog-audit:empty").digest("hex");
}

export function computeCatalogAuditDigest(
  deviations: readonly CatalogAuditDeviation[],
): string {
  if (deviations.length === 0) return emptyDigest();
  const lines = deviations
    .map((d) => {
      const codes = [...d.codes].toSorted().join(",");
      return `${d.externalVariantId}|${codes}|${d.observedSku}|${d.ledgerSku ?? ""}`;
    })
    .toSorted();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

export function classifyCatalogItem(params: {
  readonly item: CatalogAuditItemInput;
  readonly assignment: AssignmentRecord | undefined;
  readonly allowedCharacters: string;
}): CatalogAuditDeviation | null {
  const observedSku = params.item.sku.trim();
  const ledgerSku = params.assignment?.sku ?? null;
  const codes: CatalogAuditDeviationCode[] = [];

  if (observedSku.length > 0) {
    if (!validateSkuFormat(observedSku, params.allowedCharacters).ok) {
      codes.push("INVALID_FORMAT");
    }
    if (!params.assignment) {
      codes.push("MISSING_ASSIGNMENT");
    } else if (params.assignment.sku !== observedSku) {
      codes.push("SKU_MISMATCH");
    }
  } else if (params.assignment) {
    codes.push("EXTERNAL_EMPTY");
  }

  if (codes.length === 0) return null;
  return {
    externalVariantId: params.item.externalVariantId,
    codes,
    observedSku,
    ledgerSku,
    assignmentId: params.assignment?.id ?? null,
  };
}

export async function runCatalogAudit(params: {
  readonly store: SkuRegistryStore;
  readonly workspaceKey: string;
  readonly items: readonly CatalogAuditItemInput[];
  readonly previousDigest: string | null;
  readonly correlationId: string;
}): Promise<CatalogAuditResult> {
  const started = Date.now();
  if (params.items.length > CATALOG_AUDIT_MAX_BATCH) {
    throw domainError(
      fail(
        "INVALID_INPUT",
        `catalog audit batch exceeds max ${CATALOG_AUDIT_MAX_BATCH} items`,
      ),
    );
  }

  const profile = await params.store.getPublishedProfile(params.workspaceKey);
  if (!profile) {
    throw domainError(fail("PROFILE_NOT_PUBLISHED", "no published profile"));
  }
  const config = profile.config as PolicyProfileConfig;
  const assignments = await params.store.listAssignments(params.workspaceKey);
  const byVariant = new Map<string, AssignmentRecord>();
  for (const row of assignments) {
    if (row.externalVariantId) {
      byVariant.set(row.externalVariantId, row);
    }
  }

  const deviations: CatalogAuditDeviation[] = [];
  for (const item of params.items) {
    const deviation = classifyCatalogItem({
      item,
      assignment: byVariant.get(item.externalVariantId),
      allowedCharacters: config.allowedCharacters,
    });
    if (deviation) deviations.push(deviation);
  }

  const digest = computeCatalogAuditDigest(deviations);
  const shouldNotify =
    deviations.length > 0 && digest !== (params.previousDigest ?? "");

  return {
    ok: true,
    itemCount: params.items.length,
    deviationCount: deviations.length,
    deviations,
    digest,
    shouldNotify,
    durationMs: Date.now() - started,
    llmEnabled: false,
    correlationId: params.correlationId,
  };
}
