import "server-only";

import { db } from "@/lib/db";
import type { LocalizedHandleEntityType } from "@/lib/content/handle-localization";

export async function findLocalizedHandleRedirect(entityType: LocalizedHandleEntityType, fromHandle: string) {
  return db.localizedHandleRedirect.findUnique({
    where: { entityType_locale_fromHandle: { entityType, locale: "PT", fromHandle } },
  });
}

export async function recordLocalizedHandleRedirect({
  entityType,
  entityId,
  previousHandle,
  nextHandle,
}: {
  entityType: LocalizedHandleEntityType;
  entityId: string;
  previousHandle?: string | null;
  nextHandle?: string | null;
}) {
  const fromHandle = previousHandle?.trim();
  const toHandle = nextHandle?.trim();
  if (!fromHandle || !toHandle || fromHandle === toHandle) return null;
  return db.localizedHandleRedirect.upsert({
    where: { entityType_locale_fromHandle: { entityType, locale: "PT", fromHandle } },
    create: { entityType, entityId, locale: "PT", fromHandle, toHandle },
    update: { entityId, toHandle },
  });
}
