import { db } from "@/lib/db";
import type { ServiceNodeStatusRecord } from "@/lib/mission-control/status";

const NODE_KEY = "orders";
const HREF = "/admin/orders";
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Failed recent deliveries at or above this with no successes → down. */
export const ORDERS_DOWN_FAILED_MIN = 5;

export type OrdersDeps = {
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
 * Order webhook counters from `ShopifyWebhookDelivery` (request-time; no status write).
 * Local Postgres has no Order table — Shopify remains commerce SoT.
 */
export async function getOrdersStatus(
  deps: OrdersDeps = {},
): Promise<ServiceNodeStatusRecord> {
  const now = deps.now ?? new Date();
  const recentSince = new Date(now.getTime() - RECENT_WINDOW_MS);

  try {
    const [paid, cancelled, failedRecent] = await Promise.all([
      db.shopifyWebhookDelivery.count({
        where: { topic: "ORDERS_PAID", status: "SUCCEEDED" },
      }),
      db.shopifyWebhookDelivery.count({
        where: { topic: "ORDERS_CANCELLED", status: "SUCCEEDED" },
      }),
      db.shopifyWebhookDelivery.count({
        where: {
          status: "FAILED",
          createdAt: { gte: recentSince },
        },
      }),
    ]);

    const counters = { paid, cancelled, failedRecent };

    if (
      failedRecent >= ORDERS_DOWN_FAILED_MIN ||
      (failedRecent > 0 && paid === 0 && cancelled === 0)
    ) {
      return record({
        level: "down",
        message: `order webhooks failing (${failedRecent} recent)`,
        counters,
        checkedAt: now,
      });
    }

    if (failedRecent > 0) {
      return record({
        level: "warn",
        message: `${failedRecent} recent order webhook failure(s)`,
        counters,
        checkedAt: now,
      });
    }

    return record({
      level: "ok",
      message: "order webhook counters loaded",
      counters,
      checkedAt: now,
    });
  } catch {
    return record({
      level: "unknown",
      message: "order counters unavailable",
      counters: null,
      checkedAt: now,
    });
  }
}
