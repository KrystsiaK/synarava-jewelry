import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { LocalizedRecord } from "@/lib/i18n/admin-localization";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { loadReconcileSubject } from "@/lib/shopify/reconciliation-source";
import { sourceContentAsRemoteValues } from "@/lib/shopify/source-content";
import {
  planReconcile,
  projectRemoteTranslationWithMetadata,
} from "@/lib/shopify/translation-reconciliation";
import { fetchResourceTranslationState } from "@/lib/shopify/translations";

/** "en" plus every published registry locale's Shopify-side code (e.g. "pt-PT") — the full set of locales a reconcile sweep checks. */
async function reconcileLocales(): Promise<string[]> {
  const translationLocales = (await getPublishedStorefrontLocales()).filter((locale) => !locale.isDefault);
  return ["en", ...translationLocales.map((locale) => locale.shopifyLocale)];
}

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
    await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(730921441)`);

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

async function lastSnapshot(bindingId: string, locale: string) {
  const rows = await db.$queryRaw<SnapshotRow[]>(Prisma.sql`
    SELECT "values"
    FROM "ShopifyTranslationSnapshot"
    WHERE "bindingId" = ${bindingId} AND "locale" = ${locale}
    LIMIT 1
  `);
  return rows[0]?.values ?? null;
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

  const availableLocales = await reconcileLocales();
  const locales = scope?.locale ? [scope.locale] : availableLocales;
  if (locales.some((locale) => !availableLocales.includes(locale))) {
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
  // translatableContent (the source/EN copy) comes back from
  // fetchResourceTranslationState regardless of which locale is requested —
  // the query just needs some valid, non-default one to ask translations()
  // for. Any currently-published translation locale works.
  const [anyTranslationLocale] = availableLocales.filter((locale) => locale !== "en");

  try {
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
          const base = await lastSnapshot(binding.id, locale);
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
  } catch (error) {
    // Anything unexpected here (DB hiccup, a bug) must still close out the
    // run — otherwise it's stuck RUNNING forever and every future check
    // (auto or manual) just reuses that dead run instead of retrying.
    const message = error instanceof Error ? error.message : String(error);
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
