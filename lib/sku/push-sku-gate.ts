import type { SkuClient } from "@synarava/sku-contract";
import type { PendingSkuReservation } from "@/lib/sku/pending-reservation";
import { isPendingCommerceSku } from "@/lib/sku/pending-sku";

export const PUSH_SKU_UNASSIGNED_ERROR =
  "SKU is not assigned. Use Stock tab → Family → Preview → Confirm assign before Push (sku-api).";

export const PUSH_SKU_CLIENT_MISSING_ERROR =
  "SKU reservation is pending but sku-api is not configured — cannot confirm assignment. Check SKU_API_URL / SKU_API_TOKEN.";

/**
 * M8: PENDING-* commerce SKU without a reserved pending blocks Push when sku-api is configured.
 */
export function assertSkuAssignableBeforePush(input: {
  readonly skuApiConfigured: boolean;
  readonly commerceSku: string;
  readonly pendingReservation: PendingSkuReservation | null;
}): void {
  if (
    input.skuApiConfigured
    && isPendingCommerceSku(input.commerceSku)
    && !input.pendingReservation
  ) {
    throw new Error(PUSH_SKU_UNASSIGNED_ERROR);
  }
}

/**
 * M12: pending reservation on Push requires a live sku-api client to confirm.
 */
export function requireSkuClientForPendingConfirm(client: SkuClient | null): SkuClient {
  if (!client) {
    throw new Error(PUSH_SKU_CLIENT_MISSING_ERROR);
  }
  return client;
}
