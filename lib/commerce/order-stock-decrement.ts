import "server-only";

import { db } from "@/lib/db";
import { variantGidFromNumericId } from "@/lib/shopify/cart-permalink";

export type PaidOrderStockLine = {
  shopifyVariantId: string;
  quantity: number;
};

type OrdersPaidLineItem = {
  variant_id?: number | string | null;
  quantity?: number | string | null;
};

/**
 * Aggregate line_items from a Shopify ORDERS_PAID REST payload into
 * Synarava shopifyVariantId + quantity. Unknown / invalid rows are skipped.
 * @see https://shopify.dev/docs/api/admin-rest/latest/resources/webhook
 */
export function paidOrderStockLinesFromPayload(payload: {
  line_items?: unknown;
}): PaidOrderStockLine[] {
  if (!Array.isArray(payload.line_items)) return [];

  const byVariant = new Map<string, number>();
  for (const raw of payload.line_items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as OrdersPaidLineItem;
    if (item.variant_id == null || item.variant_id === "") continue;

    const numericId = String(item.variant_id).trim();
    if (!/^\d+$/.test(numericId)) continue;

    const quantity = Math.trunc(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const shopifyVariantId = variantGidFromNumericId(numericId);
    byVariant.set(shopifyVariantId, (byVariant.get(shopifyVariantId) ?? 0) + quantity);
  }

  return [...byVariant.entries()].map(([shopifyVariantId, quantity]) => ({
    shopifyVariantId,
    quantity,
  }));
}

/** Prisma client / interactive tx — only `$executeRaw` is required for the atomic decrement. */
type StockTx = {
  $executeRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<number>;
};

/**
 * Atomically decrement Synarava `stockOnHand` for paid order lines (floor 0).
 * One `UPDATE ... GREATEST(stock - qty, 0)` per variant so concurrent paid
 * deliveries cannot lose a decrement. Unknown variants are ignored.
 * Idempotency is the caller's responsibility (webhook delivery claim).
 */
export async function decrementStockForPaidOrderLines(
  lines: PaidOrderStockLine[],
  tx: StockTx = db,
): Promise<{ decremented: number; ignored: number }> {
  let decremented = 0;
  let ignored = 0;

  for (const line of lines) {
    const updated = await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockOnHand" = GREATEST("stockOnHand" - ${line.quantity}, 0)
      WHERE "shopifyVariantId" = ${line.shopifyVariantId}
    `;
    if (updated === 0) ignored += 1;
    else decremented += 1;
  }

  return { decremented, ignored };
}
