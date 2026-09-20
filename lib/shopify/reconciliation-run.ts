import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { LocalizedRecord } from "@/lib/i18n/admin-localization";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { SHOPIFY_PORTUGUESE_ADMIN_LOCALE } from "@/lib/shopify/locales";
import { loadReconcileSubject } from "@/lib/shopify/reconciliation-source";
import { sourceContentAsRemoteValues } from "@/lib/shopify/source-content";
import {
  planReconcile,
  projectRemoteTranslationWithMetadata,
} from "@/lib/shopify/translation-reconciliation";
import { fetchResourceTranslationState } from "@/lib/shopify/translations";

const RECONCILE_LOCALES = ["en", SHOPIFY_PORTUGUESE_ADMIN_LOCALE] as const;

export type ReconcileTrigger = "AUTO" | "MANUAL" | "ENTITY" | "LOCALE";
export type ReconcileRunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";

export type ReconcileScope = {
  locale?: string;
  entityType?: "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";
  entityId?: string;
  bindingId?: string;
};

export type ReconcileRunSummary = {
  id: string;
  trigger: ReconcileTrigger;
  status: ReconcileRunStatus;
  checkedCount: number;
  differenceCount: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ReconcileDifferenceView = {
  id: string;
  runId: string;
  bindingId: string;
  rootEntityType: "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";
  rootEntityId: string;
  entityLabel: string;
  locale: string;
  fieldKey: string;
  fieldLabel: string;
  targetKind: "NATIVE" | "METAFIELD" | "METAOBJECT";
  kind: "LOCAL_ONLY" | "SHOPIFY_ONLY" | "CONFLICT";
  baseValue: unknown;
  localValue: unknown;
  shopifyValue: unknown;
  localFingerprint: string;
  shopifyFingerprint: string;
  shopifyUpdatedAt: string | null;
  shopifyOutdated: boolean | null;
};

type RunRow = Omit<ReconcileRunSummary, "startedAt" | "completedAt" | "createdAt"> & {
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

type SnapshotRow = { values: LocalizedRecord };

function serializeRun(row: RunRow): ReconcileRunSummary {
  return {
    ...row,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function runById(client: Prisma.TransactionClient | typeof db, id: string) {
  const rows = await client.$queryRaw<RunRow[]>(Prisma.sql`
    SELECT
      "id",
      "trigger"::text AS "trigger",
      "status"::text AS "status",
      "checkedCount",
      "differenceCount",
      "error",
      "startedAt",
      "completedAt",
      "createdAt"
    FROM "ShopifyReconcileRun"
    WHERE "id" = ${id}
    LIMIT 1
  `);
  return rows[0] ? serializeRun(rows[0]) : null;
}

export async function getLatestReconcileRun(): Promise<ReconcileRunSummary | null> {
  const rows = await db.$queryRaw<RunRow[]>(Prisma.sql`
    SELECT
      "id",
      "trigger"::text AS "trigger",
      "status"::text AS "status",
      "checkedCount",
      "differenceCount",
      "error",
      "startedAt",
      "completedAt",
      "createdAt"
    FROM "ShopifyReconcileRun"
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);
  return rows[0] ? serializeRun(rows[0]) : null;
}

export async function getLatestReconcileDifferences(): Promise<ReconcileDifferenceView[]> {
  const rows = await db.$queryRaw<Array<Omit<ReconcileDifferenceView, "shopifyUpdatedAt"> & { shopifyUpdatedAt: Date | null }>>(Prisma.sql`
    SELECT
      difference."id",
      difference."runId",
      difference."bindingId",
      difference."rootEntityType",
      difference."rootEntityId",
      difference."entityLabel",
      difference."locale",
      difference."fieldKey",
      difference."fieldLabel",
      difference."targetKind"::text AS "targetKind",
      difference."kind"::text AS "kind",
      difference."baseValue",
      difference."localValue",
      difference."shopifyValue",
      difference."localFingerprint",
      difference."shopifyFingerprint",
      difference."shopifyUpdatedAt",
      difference."shopifyOutdated"
    FROM "ShopifyFieldDivergence" AS difference
    WHERE
      difference."resolvedAt" IS NULL
      AND difference."runId" = (
        SELECT run."id"
        FROM "ShopifyReconcileRun" AS run
        WHERE run."status" IN ('SUCCEEDED', 'PARTIAL')
        ORDER BY run."createdAt" DESC
        LIMIT 1
      )
    ORDER BY
      difference."rootEntityType" ASC,
      difference."entityLabel" ASC,
      difference."locale" ASC,
      difference."fieldLabel" ASC
  `);
  return rows.map((row) => ({
    ...row,
    shopifyUpdatedAt: row.shopifyUpdatedAt?.toISOString() ?? null,
  }));
}

export async function getLatestEntityReconcileState({
  entityType,
  entityId,
  locale,
}: {
  entityType: ReconcileDifferenceView["rootEntityType"];
  entityId: string;
  locale: string;
}) {
  const run = await getLatestReconcileRun();
  if (!run) return { run: null, differenceCount: 0 };
  const rows = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "ShopifyFieldDivergence"
    WHERE
      "runId" = ${run.id}
      AND "resolvedAt" IS NULL
      AND "rootEntityType" = ${entityType}
      AND "rootEntityId" = ${entityId}
      AND "locale" = ${locale}
  `);
  return { run, differenceCount: Number(rows[0]?.count ?? 0) };
}

async function createOrReuseRun({
  trigger,
  scope,
  requestedBy,
}: {
  trigger: ReconcileTrigger;
  scope?: ReconcileScope;
  requestedBy?: string | null;
}) {
  return db.$transaction(async (transaction) => {
    // One short database lock protects the check/create window across tabs
    // and app instances. It does not cover the Shopify network work.
    await transaction.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(730921441)`);

    const active = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "ShopifyReconcileRun"
      WHERE "status" IN ('QUEUED', 'RUNNING')
      ORDER BY "createdAt" DESC
      LIMIT 1
    `);
    if (active[0]) return { run: await runById(transaction, active[0].id), reused: true };

    if (trigger === "AUTO") {
      const recent = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "ShopifyReconcileRun"
        WHERE "completedAt" > CURRENT_TIMESTAMP - INTERVAL '2 minutes'
        ORDER BY "createdAt" DESC
        LIMIT 1
      `);
      if (recent[0]) return { run: await runById(transaction, recent[0].id), reused: true };
    }

    const id = randomUUID();
    const serializedScope = scope ? JSON.stringify(scope) : null;
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO "ShopifyReconcileRun" (
        "id", "trigger", "status", "scope", "requestedBy", "startedAt", "createdAt", "updatedAt"
      ) VALUES (
        ${id},
        CAST(${trigger} AS "ShopifyReconcileTrigger"),
        'RUNNING',
        CAST(${serializedScope} AS JSONB),
        ${requestedBy ?? null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);
    return { run: await runById(transaction, id), reused: false };
  });
}

async function lastSnapshot(bindingId: string, legacySnapshot: unknown, locale: string) {
  const rows = await db.$queryRaw<SnapshotRow[]>(Prisma.sql`
    SELECT "values"
    FROM "ShopifyTranslationSnapshot"
    WHERE "bindingId" = ${bindingId} AND "locale" = ${locale}
    LIMIT 1
  `);
  return rows[0]?.values
    ?? (locale === SHOPIFY_PORTUGUESE_ADMIN_LOCALE ? legacySnapshot as LocalizedRecord | null : null)
    ?? null;
}

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

async function persistDifferences({
  runId,
  bindingId,
  subject,
  locale,
  differences,
}: {
  runId: string;
  bindingId: string;
  subject: Awaited<ReturnType<typeof loadReconcileSubject>> & {};
  locale: string;
  differences: ReturnType<typeof planReconcile>["differences"];
}) {
  if (differences.length === 0) return;

  await db.$transaction(
    differences.map((difference) => db.$executeRaw(Prisma.sql`
      INSERT INTO "ShopifyFieldDivergence" (
        "id", "runId", "bindingId", "rootEntityType", "rootEntityId", "entityLabel",
        "locale", "fieldKey", "fieldLabel", "targetKind", "kind",
        "baseValue", "localValue", "shopifyValue", "localFingerprint", "shopifyFingerprint",
        "shopifyUpdatedAt", "shopifyOutdated", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()},
        ${runId},
        ${bindingId},
        ${subject.rootEntityType},
        ${subject.rootEntityId},
        ${subject.label},
        ${locale},
        ${difference.fieldKey},
        ${difference.fieldLabel},
        CAST(${difference.targetKind.toUpperCase()} AS "ShopifyTranslationTargetKind"),
        CAST(${difference.kind.replace("-", "_").toUpperCase()} AS "ShopifyFieldDifferenceKind"),
        CAST(${json(difference.baseValue)} AS JSONB),
        CAST(${json(difference.localValue)} AS JSONB),
        CAST(${json(difference.shopifyValue)} AS JSONB),
        ${difference.localFingerprint},
        ${difference.shopifyFingerprint},
        ${difference.shopifyUpdatedAt ? new Date(difference.shopifyUpdatedAt) : null},
        ${difference.shopifyOutdated},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `)),
  );
}

async function finishRun(
  id: string,
  result: { status: Exclude<ReconcileRunStatus, "QUEUED" | "RUNNING">; checkedCount: number; differenceCount: number; error?: string | null },
) {
  await db.$executeRaw(Prisma.sql`
    UPDATE "ShopifyReconcileRun"
    SET
      "status" = CAST(${result.status} AS "ShopifyReconcileStatus"),
      "checkedCount" = ${result.checkedCount},
      "differenceCount" = ${result.differenceCount},
      "error" = ${result.error ?? null},
      "completedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
  `);
  return runById(db, id);
}

function scopeMatches(
  scope: ReconcileScope | undefined,
  bindingId: string,
  subject: NonNullable<Awaited<ReturnType<typeof loadReconcileSubject>>>,
) {
  if (!scope) return true;
  if (scope.bindingId && scope.bindingId !== bindingId) return false;
  if (scope.entityType && scope.entityType !== subject.rootEntityType) return false;
  if (scope.entityId && scope.entityId !== subject.rootEntityId) return false;
  return true;
}

export async function runTranslationReconciliation({
  trigger,
  requestedBy,
  scope,
}: {
  trigger: ReconcileTrigger;
  requestedBy?: string | null;
  scope?: ReconcileScope;
}) {
  const created = await createOrReuseRun({ trigger, scope, requestedBy });
  if (!created.run || created.reused) return created;

  const runId = created.run.id;
  if (!hasShopifyAdminConfig()) {
    return {
      run: await finishRun(runId, {
        status: "FAILED",
        checkedCount: 0,
        differenceCount: 0,
        error: "Shopify connection is not configured. Add Admin API access before checking translations.",
      }),
      reused: false,
    };
  }

  const locales = scope?.locale ? [scope.locale] : [...RECONCILE_LOCALES];
  if (locales.some((locale) => !RECONCILE_LOCALES.includes(locale as (typeof RECONCILE_LOCALES)[number]))) {
    return {
      run: await finishRun(runId, {
        status: "FAILED",
        checkedCount: 0,
        differenceCount: 0,
        error: `Locale ${scope?.locale} is not configured for Shopify reconciliation.`,
      }),
      reused: false,
    };
  }

  const bindings = await db.shopifyTranslationBinding.findMany({
    where: scope?.bindingId ? { id: scope.bindingId } : undefined,
    orderBy: { createdAt: "asc" },
  });

  let checkedCount = 0;
  let differenceCount = 0;
  const failures: string[] = [];

  // Intentionally sequential for the first rollout: a background check is
  // less valuable than predictable Shopify throttling behavior. A bounded
  // concurrency pool can be added after observing real run timings.
  for (const binding of bindings) {
    let state: Awaited<ReturnType<typeof fetchResourceTranslationState>>;
    try {
      state = await fetchResourceTranslationState(binding.shopifyResourceId, SHOPIFY_PORTUGUESE_ADMIN_LOCALE);
      if (!state) throw new Error("Shopify no longer exposes this resource as translatable.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${binding.entityId}: ${message}`);
      continue;
    }

    for (const locale of locales) {
      try {
        const subject = await loadReconcileSubject(binding, locale);
        if (!subject || !scopeMatches(scope, binding.id, subject)) continue;

        const translations = locale === "en"
          ? sourceContentAsRemoteValues(state.translatableContent)
          : state.translations;
        const remote = projectRemoteTranslationWithMetadata(subject.registry, translations);
        const base = await lastSnapshot(binding.id, binding.lastSyncedSnapshot, locale);
        const plan = planReconcile(subject.registry, base, subject.local, remote.values, remote.metadata);
        await persistDifferences({
          runId,
          bindingId: binding.id,
          subject,
          locale,
          differences: plan.differences,
        });
        checkedCount += 1;
        differenceCount += plan.differences.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${binding.entityId} (${locale}): ${message}`);
      }
    }
  }

  const error = failures.length > 0
    ? `${failures.length} check${failures.length === 1 ? "" : "s"} could not be completed. ${failures.slice(0, 3).join(" ")}`
    : null;
  const status: ReconcileRunStatus = failures.length === 0 ? "SUCCEEDED" : checkedCount > 0 ? "PARTIAL" : "FAILED";

  return {
    run: await finishRun(runId, { status, checkedCount, differenceCount, error }),
    reused: false,
  };
}

export async function hasSessionReconciled(sessionId: string) {
  const rows = await db.$queryRaw<Array<{ checked: boolean }>>(Prisma.sql`
    SELECT ("lastShopifyReconcileAt" IS NOT NULL) AS "checked"
    FROM "AdminSession"
    WHERE "id" = ${sessionId}
    LIMIT 1
  `);
  return rows[0]?.checked ?? false;
}

export async function markSessionReconciled(sessionId: string) {
  await db.$executeRaw(Prisma.sql`
    UPDATE "AdminSession"
    SET "lastShopifyReconcileAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${sessionId}
  `);
}
