import "server-only";

import { Prisma, type ContentLocale, type SyncDirection, type SyncEventStatus, type TranslationResourceType } from "@prisma/client";
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

export async function findTranslationBinding(resourceType: TranslationResourceType, entityId: string) {
  return db.shopifyTranslationBinding.findUnique({ where: { resourceType_entityId: { resourceType, entityId } } });
}

/** Every push/pull/reconcile attempt gets its own event row — the audit trail tasks/plan.md's sync model requires, independent of ProductSyncEvent's commerce sync history. */
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
  locale: ContentLocale;
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

/**
 * Re-runs `perform` for an existing event and updates its status in place —
 * idempotent because it never touches the locally persisted translation
 * content, only this bookkeeping row, so a failed retry cannot lose local
 * copy (tasks/plan.md Task 6 acceptance).
 */
export async function retrySyncEvent(eventId: string, perform: () => Promise<void>) {
  await db.translationSyncEvent.update({
    where: { id: eventId },
    data: { status: "PROCESSING", attemptCount: { increment: 1 } },
  });

  try {
    await perform();
    return db.translationSyncEvent.update({
      where: { id: eventId },
      data: { status: "SUCCEEDED", error: null, completedAt: new Date() },
    });
  } catch (error) {
    return db.translationSyncEvent.update({
      where: { id: eventId },
      data: { status: "FAILED", error: error instanceof Error ? error.message : String(error), completedAt: new Date() },
    });
  }
}
