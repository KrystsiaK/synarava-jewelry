import "server-only";

import { Prisma, type SyncDirection, type SyncEventStatus, type TranslationResourceType } from "@prisma/client";
import { db } from "@/lib/db";
import type { FieldConflict } from "@/lib/i18n/admin-localization";

const TERMINAL_STATUSES: SyncEventStatus[] = ["SUCCEEDED", "FAILED", "CONFLICT", "IGNORED"];

/** One binding per (resourceType, entityId) and per (resourceType, shopifyResourceId) — enforced by the schema's compound unique indexes, not just this upsert. */
export async function ensureTranslationBinding({
  resourceType,
  entityId,
  shopifyResourceId,
}: {
  resourceType: TranslationResourceType;
  entityId: string;
  shopifyResourceId: string;
}) {
  return db.shopifyTranslationBinding.upsert({
    where: { resourceType_entityId: { resourceType, entityId } },
    create: { resourceType, entityId, shopifyResourceId },
    update: { shopifyResourceId },
  });
}

/** Every push/pull/reconcile attempt gets its own event row — the audit trail docs/history/2026-09-en-pt-translation-plan.md's sync model requires, independent of ProductSyncEvent's commerce sync history. */
export async function recordSyncEvent({
  bindingId,
  locale,
  direction,
  status,
  fieldConflicts,
  error,
  actorUsername,
}: {
  bindingId: string;
  locale: string;
  direction: SyncDirection;
  status: SyncEventStatus;
  fieldConflicts?: FieldConflict[];
  error?: string;
  actorUsername?: string | null;
}) {
  return db.translationSyncEvent.create({
    data: {
      bindingId,
      locale,
      direction,
      status,
      fieldConflicts: fieldConflicts as unknown as Prisma.InputJsonValue | undefined,
      error,
      ...(actorUsername ? { actorUsername } : {}),
      completedAt: TERMINAL_STATUSES.includes(status) ? new Date() : null,
    },
  });
}

export async function recordReconcileAuditDetails({
  eventId,
  scope,
  selectedSide,
  localFingerprint,
  shopifyFingerprint,
  resultFingerprint,
  shopifyResponse,
}: {
  eventId: string;
  scope: Record<string, unknown>;
  selectedSide: "SYNARAVA" | "SHOPIFY";
  localFingerprint: string;
  shopifyFingerprint: string;
  resultFingerprint?: string | null;
  shopifyResponse?: Record<string, unknown> | null;
}) {
  await db.$executeRaw(Prisma.sql`
    UPDATE "TranslationSyncEvent"
    SET
      "scope" = CAST(${JSON.stringify(scope)} AS JSONB),
      "selectedSide" = ${selectedSide},
      "localFingerprint" = ${localFingerprint},
      "shopifyFingerprint" = ${shopifyFingerprint},
      "resultFingerprint" = ${resultFingerprint ?? null},
      "shopifyResponse" = CAST(${JSON.stringify(shopifyResponse ?? null)} AS JSONB),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${eventId}
  `);
}
