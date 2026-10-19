import { db } from "@/lib/db";
import type { ServiceNodeStatusRecord } from "@/lib/mission-control/status";

const NODE_KEY = "shopify-sync";
const HREF = "/admin/products";

/** Fresh enough for green. */
export const SHOPIFY_SYNC_OK_MAX_HOURS = 6;
/** Past this → warn (until down threshold). */
export const SHOPIFY_SYNC_WARN_MAX_HOURS = 48;

export type ShopifySyncDeps = {
  now?: Date;
};

function record(
  partial: Omit<ServiceNodeStatusRecord, "nodeKey" | "href" | "checkedAt" | "updatedAt"> & {
    checkedAt: Date;
  },
): ServiceNodeStatusRecord {
  return {
    nodeKey: NODE_KEY,
    href: HREF,
    updatedAt: partial.checkedAt,
    ...partial,
  };
}

/**
 * Age of the latest successful `ProductSyncEvent` (request-time; no status table write).
 */
export async function getShopifySyncStatus(
  deps: ShopifySyncDeps = {},
): Promise<ServiceNodeStatusRecord> {
  const now = deps.now ?? new Date();

  try {
    const latest = await db.productSyncEvent.findFirst({
      where: { status: "SUCCEEDED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, status: true },
    });

    if (!latest?.completedAt) {
      return record({
        level: "unknown",
        message: "no successful product sync yet",
        counters: null,
        checkedAt: now,
      });
    }

    const ageMs = now.getTime() - latest.completedAt.getTime();
    const ageHours = Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10;

    if (ageHours > SHOPIFY_SYNC_WARN_MAX_HOURS) {
      return record({
        level: "down",
        message: `last sync overdue (${ageHours}h ago)`,
        counters: { ageHours, lastSucceededAt: latest.completedAt.toISOString() },
        checkedAt: now,
      });
    }

    if (ageHours > SHOPIFY_SYNC_OK_MAX_HOURS) {
      return record({
        level: "warn",
        message: `last sync stale (${ageHours}h ago)`,
        counters: { ageHours, lastSucceededAt: latest.completedAt.toISOString() },
        checkedAt: now,
      });
    }

    return record({
      level: "ok",
      message: `last sync ${ageHours}h ago`,
      counters: { ageHours, lastSucceededAt: latest.completedAt.toISOString() },
      checkedAt: now,
    });
  } catch {
    return record({
      level: "unknown",
      message: "product sync query unavailable",
      counters: null,
      checkedAt: now,
    });
  }
}
