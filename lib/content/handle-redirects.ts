import "server-only";

import { db } from "@/lib/db";
import type { LocalizedHandleEntityType } from "@/lib/content/handle-localization";

export async function findLocalizedHandleRedirect(entityType: LocalizedHandleEntityType, locale: string, fromHandle: string) {
  return db.localizedHandleRedirect.findUnique({
    where: { entityType_locale_fromHandle: { entityType, locale, fromHandle } },
  });
}

export async function recordLocalizedHandleRedirect({
  entityType,
  entityId,
  locale,
  previousHandle,
  nextHandle,
}: {
  entityType: LocalizedHandleEntityType;
  entityId: string;
  locale: string;
  previousHandle?: string | null;
  nextHandle?: string | null;
}) {
  const fromHandle = previousHandle?.trim();
  const toHandle = nextHandle?.trim();
  if (!fromHandle || !toHandle || fromHandle === toHandle) return null;
  return db.localizedHandleRedirect.upsert({
    where: { entityType_locale_fromHandle: { entityType, locale, fromHandle } },
    create: { entityType, entityId, locale, fromHandle, toHandle },
    update: { entityId, toHandle },
  });
}
