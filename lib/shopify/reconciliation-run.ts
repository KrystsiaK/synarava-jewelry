import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { loadReconcileSubject } from "@/lib/shopify/reconciliation-source";
import { sourceContentAsRemoteValues } from "@/lib/shopify/source-content";
import {
  planReconcile,
  projectRemoteTranslationWithMetadata,
} from "@/lib/shopify/translation-reconciliation";
import { fetchResourceTranslationState } from "@/lib/shopify/translations";
import type {
  ReconcileDifferenceView,
  ReconcileRunStatus,
  ReconcileRunSummary,
  ReconcileScope,
  ReconcileTrigger,
} from "@/lib/shopify/reconciliation-types";

export type {
  ReconcileDifferenceView,
  ReconcileRunStatus,
  ReconcileRunSummary,
  ReconcileScope,
  ReconcileTrigger,
} from "@/lib/shopify/reconciliation-types";

/** "en" plus every published registry locale's Shopify-side code (e.g. "pt-PT") — the full set of locales a reconcile sweep checks. */
async function reconcileLocales(): Promise<string[]> {
  const translationLocales = (await getPublishedStorefrontLocales()).filter((locale) => !locale.isDefault);
  return ["en", ...translationLocales.map((locale) => locale.shopifyLocale)];
}

type RunRow = Omit<ReconcileRunSummary, "startedAt" | "completedAt" | "createdAt" | "updatedAt"> & {
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeRun(row: RunRow): ReconcileRunSummary {
  return {
    ...row,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
      "createdAt",
      "updatedAt"
    FROM "ShopifyReconcileRun"
    WHERE "id" = ${id}
    LIMIT 1
  `);
  return rows[0] ? serializeRun(rows[0]) : null;
}

/**
 * Mark a QUEUED/RUNNING catalog run FAILED when its lease (updatedAt) has expired.
 * Called on read so a dead row never looks like a live check in the top bar.
 */
async function expireStaleActiveRunIfNeeded(run: ReconcileRunSummary): Promise<ReconcileRunSummary> {
  if (run.status !== "QUEUED" && run.status !== "RUNNING") return run;
  if (!isRunPastLease({
    updatedAt: new Date(run.updatedAt),
    startedAt: run.startedAt ? new Date(run.startedAt) : null,
    createdAt: new Date(run.createdAt),
  }, Date.now())) {
    return run;
  }
  await db.$executeRaw(Prisma.sql`
    UPDATE "ShopifyReconcileRun"
    SET
      "status" = CAST('FAILED' AS "ShopifyReconcileStatus"),
      "error" = ${"Check timed out (lease expired after 10 minutes)."},
      "completedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${run.id}
      AND "status" IN ('QUEUED', 'RUNNING')
  `);
  return (await runById(db, run.id)) ?? {
    ...run,
    status: "FAILED",
    error: "Check timed out (lease expired after 10 minutes).",
    completedAt: new Date().toISOString(),
  };
}

/**
 * Latest FULL catalog reconcile run (scope null, AUTO/MANUAL).
 * Scoped LOCALE/ENTITY runs must not hide a failed catalog check
 * (audit: global getLatestReconcileRun).
 */
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
      "createdAt",
      "updatedAt"
    FROM "ShopifyReconcileRun"
    WHERE "trigger" IN ('AUTO', 'MANUAL')
      AND ("scope" IS NULL OR "scope" = 'null'::jsonb)
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);
  if (!rows[0]) return null;
  return expireStaleActiveRunIfNeeded(serializeRun(rows[0]));
}

/**
 * The current set of unresolved differences: the most recently recorded
 * unresolved row per (binding, locale, fieldKey), not "everything from the
 * single latest run". A run only ever re-checks the bindings/locales in its
 * own scope (see `runTranslationReconciliation`'s `scope`); filtering by a
 * single global latest run id would make a narrow recheck of one product or
 * locale hide every other binding's still-valid, still-unresolved
 * differences the moment it completes. `persistDifferences` keeps this
 * table self-consistent by resolving stale rows for exactly the
 * (binding, locale) pair it just rechecked, so a row surviving here always
 * reflects that pair's last actual check, whichever run performed it.
 */
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
    FROM (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY "bindingId", "locale", "fieldKey"
          ORDER BY "createdAt" DESC
        ) AS "rn"
      FROM "ShopifyFieldDivergence"
      WHERE "resolvedAt" IS NULL
    ) AS difference
    WHERE difference."rn" = 1
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
  const [run, allDifferences] = await Promise.all([getLatestReconcileRun(), getLatestReconcileDifferences()]);
  const differences = allDifferences.filter((difference) =>
    difference.rootEntityType === entityType
    && difference.rootEntityId === entityId
    && difference.locale === locale,
  );
  return { run, differenceCount: differences.length, differences };
}

/** Running checks older than this are treated as dead and may be superseded. */
export const CATALOG_CHECK_LEASE_MS = 10 * 60 * 1000;

export type BeginCatalogCheckResult =
  | { status: "started"; run: ReconcileRunSummary }
  | { status: "already_running"; run: ReconcileRunSummary }
  | { status: "reused_recent_auto"; run: ReconcileRunSummary };

type CreateOrReuseResult = {
  run: ReconcileRunSummary | null;
  reused: boolean;
  /** Why createOrReuse returned without starting fresh work. */
  reason?: "already_running" | "reused_recent_auto";
};

/** Lease measured by updatedAt (heartbeat); fall back to startedAt/createdAt. */
function isRunPastLease(
  row: { updatedAt?: Date | null; startedAt: Date | null; createdAt: Date },
  nowMs: number,
) {
  const anchor = row.updatedAt ?? row.startedAt ?? row.createdAt;
  return nowMs - anchor.getTime() > CATALOG_CHECK_LEASE_MS;
}

/** Heartbeat so long catalog refreshes do not trip the 10-minute lease. */
export async function heartbeatCatalogCheckRun(id: string): Promise<void> {
  await db.$executeRaw(Prisma.sql`
    UPDATE "ShopifyReconcileRun"
    SET "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "status" IN ('QUEUED', 'RUNNING')
  `);
}

/** True when a run summary is still within the active lease window. */
export function isReconcileRunActivelyChecking(run: ReconcileRunSummary | null): boolean {
  if (!run) return false;
  if (run.status !== "QUEUED" && run.status !== "RUNNING") return false;
  return !isRunPastLease({
    updatedAt: new Date(run.updatedAt),
    startedAt: run.startedAt ? new Date(run.startedAt) : null,
    createdAt: new Date(run.createdAt),
  }, Date.now());
}

async function createOrReuseRun({
  trigger,
  scope,
  requestedBy,
}: {
  trigger: ReconcileTrigger;
  scope?: ReconcileScope;
  requestedBy?: string | null;
}): Promise<CreateOrReuseResult> {
  return db.$transaction(async (transaction) => {
    // One short database lock protects the check/create window across tabs
    // and app instances. It does not cover the Shopify network work.
    await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(730921441)`);

    const active = await transaction.$queryRaw<Array<{
      id: string;
      startedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>>(Prisma.sql`
      SELECT "id", "startedAt", "createdAt", "updatedAt"
      FROM "ShopifyReconcileRun"
      WHERE "status" IN ('QUEUED', 'RUNNING')
      ORDER BY "createdAt" DESC
      LIMIT 1
    `);
    if (active[0]) {
      if (isRunPastLease(active[0], Date.now())) {
        // Stale lease: mark dead so a new check can start.
        await transaction.$executeRaw(Prisma.sql`
          UPDATE "ShopifyReconcileRun"
          SET
            "status" = CAST('FAILED' AS "ShopifyReconcileStatus"),
            "error" = ${"Check timed out (lease expired after 10 minutes)."},
            "completedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${active[0].id}
            AND "status" IN ('QUEUED', 'RUNNING')
        `);
      } else {
        return {
          run: await runById(transaction, active[0].id),
          reused: true,
          reason: "already_running" as const,
        };
      }
    }

    if (trigger === "AUTO") {
      const recent = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "ShopifyReconcileRun"
        WHERE "completedAt" > CURRENT_TIMESTAMP - INTERVAL '2 minutes'
          AND "trigger" IN ('AUTO', 'MANUAL')
          AND ("scope" IS NULL OR "scope" = 'null'::jsonb)
          AND "status" = 'SUCCEEDED'
        ORDER BY "createdAt" DESC
        LIMIT 1
      `);
      if (recent[0]) {
        return {
          run: await runById(transaction, recent[0].id),
          reused: true,
          reason: "reused_recent_auto" as const,
        };
      }
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

/**
 * Single-flight gate for the full catalog check (top-bar + post-save).
 * Reuses ShopifyReconcileRun; a RUNNING/QUEUED row younger than the lease
 * blocks a second start with `already_running`.
 */
export async function beginCatalogCheckRun({
  trigger,
  requestedBy,
}: {
  trigger: "AUTO" | "MANUAL";
  requestedBy?: string | null;
}): Promise<BeginCatalogCheckResult> {
  const created = await createOrReuseRun({ trigger, requestedBy });
  if (!created.run) {
    throw new Error("Could not create a Shopify check run.");
  }
  if (created.reason === "already_running") {
    return { status: "already_running", run: created.run };
  }
  if (created.reason === "reused_recent_auto") {
    return { status: "reused_recent_auto", run: created.run };
  }
  return { status: "started", run: created.run };
}

export async function finishCatalogCheckRun(
  id: string,
  result: {
    status: Exclude<ReconcileRunStatus, "QUEUED" | "RUNNING">;
    checkedCount: number;
    differenceCount: number;
    error?: string | null;
  },
) {
  return finishRun(id, result);
}

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

/**
 * Builds (without executing) the retire step for this exact (binding,
 * locale) pair — every currently unresolved row is superseded by this
 * check's `differences`, the complete, authoritative current state for
 * that pair. This must happen even for a field that's still differing:
 * leaving its old row unresolved and merely adding a second, newer row for
 * the same field means resolving that newer row (via the apply flow)
 * uncovers the stale old one, which then reappears in
 * `getLatestReconcileDifferences()` as if it were current. Only the
 * (binding, locale) actually rechecked is touched, not every row in the
 * table.
 *
 * Returned unexecuted (a PrismaPromise) so `persistDifferences` can run it
 * in the same `$transaction` as the inserts below — retiring old rows and
 * inserting the new ones must commit or fail together. Run separately, a
 * failed insert would leave this (binding, locale) pair's retire already
 * committed with nothing to replace it, silently wiping real conflicts.
 */
function retireStaleDifferences(bindingId: string, locale: string) {
  return db.$executeRaw(Prisma.sql`
    UPDATE "ShopifyFieldDivergence"
    SET "resolvedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "bindingId" = ${bindingId} AND "locale" = ${locale} AND "resolvedAt" IS NULL
  `);
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
  await db.$transaction([
    retireStaleDifferences(bindingId, locale),
    ...differences.map((difference) => db.$executeRaw(Prisma.sql`
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
  ]);
}

async function finishRun(
  id: string,
  result: { status: Exclude<ReconcileRunStatus, "QUEUED" | "RUNNING">; checkedCount: number; differenceCount: number; error?: string | null },
) {
  // Only finish an still-active row — a superseded/expired run must not be rewritten.
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
      AND "status" IN ('QUEUED', 'RUNNING')
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

export type AttachedTranslationReconciliationResult = {
  run: ReconcileRunSummary | null;
  reused: false;
  checkedCount: number;
  differenceCount: number;
  translationError: string | null;
  translationStatus: Exclude<ReconcileRunStatus, "QUEUED" | "RUNNING">;
};

export type OwnedTranslationReconciliationResult = CreateOrReuseResult | {
  run: ReconcileRunSummary | null;
  reused: false;
};

/** Catalog waterfall: attach to an existing run; caller finishes the run. */
export async function runTranslationReconciliation(input: {
  trigger: ReconcileTrigger;
  requestedBy?: string | null;
  scope?: ReconcileScope;
  attachToRunId: string;
}): Promise<AttachedTranslationReconciliationResult>;
/** Standalone translation check: creates/reuses and finishes its own run. */
export async function runTranslationReconciliation(input: {
  trigger: ReconcileTrigger;
  requestedBy?: string | null;
  scope?: ReconcileScope;
  attachToRunId?: undefined;
}): Promise<OwnedTranslationReconciliationResult>;
export async function runTranslationReconciliation({
  trigger,
  requestedBy,
  scope,
  /**
   * When set, differences attach to this run and the caller owns finish.
   * Used by the full catalog waterfall so RUNNING covers translations +
   * presence + commerce refresh, not only the translation loop.
   */
  attachToRunId,
}: {
  trigger: ReconcileTrigger;
  requestedBy?: string | null;
  scope?: ReconcileScope;
  attachToRunId?: string;
}): Promise<AttachedTranslationReconciliationResult | OwnedTranslationReconciliationResult> {
  let runId: string;
  if (attachToRunId) {
    runId = attachToRunId;
  } else {
    const created = await createOrReuseRun({ trigger, scope, requestedBy });
    if (!created.run || created.reused) return created;
    runId = created.run.id;
  }

  const closeOwnRun = !attachToRunId;

  if (!hasShopifyAdminConfig()) {
    const failed = {
      status: "FAILED" as const,
      checkedCount: 0,
      differenceCount: 0,
      error: "Shopify connection is not configured. Add Admin API access before checking translations.",
    };
    if (!closeOwnRun) throw new Error(failed.error);
    return { run: await finishRun(runId, failed), reused: false };
  }

  const availableLocales = await reconcileLocales();
  const locales = scope?.locale ? [scope.locale] : availableLocales;
  if (locales.some((locale) => !availableLocales.includes(locale))) {
    const failed = {
      status: "FAILED" as const,
      checkedCount: 0,
      differenceCount: 0,
      error: `Locale ${scope?.locale} is not configured for Shopify reconciliation.`,
    };
    if (!closeOwnRun) throw new Error(failed.error);
    return { run: await finishRun(runId, failed), reused: false };
  }
  // translatableContent (the source/EN copy) comes back from
  // fetchResourceTranslationState regardless of which locale is requested —
  // the query just needs some valid, non-default one to ask translations()
  // for. Any currently-published translation locale works.
  const [anyTranslationLocale] = availableLocales.filter((locale) => locale !== "en");

  try {
    const bindings = await db.shopifyTranslationBinding.findMany({
      where: scope?.bindingId ? { id: scope.bindingId }
        : scope?.entityType === "PRODUCT" && scope.entityId ? {
          OR: [
            { resourceType: "PRODUCT", entityId: scope.entityId },
            { resourceType: "METAOBJECT", entityId: { startsWith: `${scope.entityId}:` } },
          ],
        } : undefined,
      orderBy: { createdAt: "asc" },
    });

    let checkedCount = 0;
    let differenceCount = 0;
    const failures: string[] = [];

    // Intentionally sequential for the first rollout: a background check is
    // less valuable than predictable Shopify throttling behavior. A bounded
    // concurrency pool can be added after observing real run timings.
    for (const binding of bindings) {
      for (const locale of locales) {
        try {
          const subject = await loadReconcileSubject(binding, locale);
          if (!subject || !scopeMatches(scope, binding.id, subject)) continue;

          if (locale === "en" && !anyTranslationLocale) {
            throw new Error("No published translation locale is registered to read Shopify's source content through.");
          }
          const state = await fetchResourceTranslationState(binding.shopifyResourceId, locale === "en" ? anyTranslationLocale : locale);
          if (!state) throw new Error("Shopify no longer exposes this resource as translatable.");

          const translations = locale === "en"
            ? sourceContentAsRemoteValues(state.translatableContent)
            : state.translations;
          const remote = projectRemoteTranslationWithMetadata(subject.registry, translations);
          // Two-way only: Synarava local ↔ live Shopify (no common-ancestor base).
          const plan = planReconcile(subject.registry, subject.local, remote.values, remote.metadata);
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
      // Heartbeat per binding so long translation loops keep the lease.
      await heartbeatCatalogCheckRun(runId);
    }

    const error = failures.length > 0
      ? `${failures.length} check${failures.length === 1 ? "" : "s"} could not be completed. ${failures.slice(0, 3).join(" ")}`
      : null;
    const status: ReconcileRunStatus = failures.length === 0 ? "SUCCEEDED" : checkedCount > 0 ? "PARTIAL" : "FAILED";

    if (!closeOwnRun) {
      return {
        run: await runById(db, runId),
        reused: false,
        checkedCount,
        differenceCount,
        translationError: error,
        translationStatus: status,
      };
    }

    return {
      run: await finishRun(runId, { status, checkedCount, differenceCount, error }),
      reused: false,
    };
  } catch (error) {
    // Anything unexpected here (DB hiccup, a bug) must still close out the
    // run — otherwise it's stuck RUNNING forever and every future check
    // (auto or manual) just reuses that dead run instead of retrying.
    const message = error instanceof Error ? error.message : String(error);
    if (!closeOwnRun) throw error;
    return {
      run: await finishRun(runId, {
        status: "FAILED",
        checkedCount: 0,
        differenceCount: 0,
        error: message,
      }),
      reused: false,
    };
  }
}

export async function hasSessionReconciled(sessionId: string) {
  // AdminSession.id is Postgres UUID; Prisma.$queryRaw binds strings as text and
  // fails with `operator does not exist: uuid = text`. Use the typed client.
  const session = await db.adminSession.findUnique({
    where: { id: sessionId },
    select: { lastShopifyReconcileAt: true },
  });
  return session?.lastShopifyReconcileAt != null;
}

export async function markSessionReconciled(sessionId: string) {
  await db.adminSession.update({
    where: { id: sessionId },
    data: { lastShopifyReconcileAt: new Date() },
  });
}
