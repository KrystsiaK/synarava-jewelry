import "server-only";

import { randomUUID } from "node:crypto";
import type { SkuClient } from "@synarava/sku-contract";
import {
  readPendingSkuReservation,
  withPendingSkuReservation,
  withoutPendingSkuReservation,
  type PendingSkuReservation,
} from "@/lib/sku/pending-reservation";
import { isPendingCommerceSku } from "@/lib/sku/pending-sku";
import { writeShopifyVariantSku } from "@/lib/sku/write-shopify-variant-sku";

export type AssignVariantSkuInput = {
  readonly productId: string;
  readonly familyKey: string;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
};

export type AssignVariantSkuResult =
  | {
      readonly ok: true;
      readonly sku: string;
      readonly reservationId: string;
      readonly assignmentId: string | null;
      readonly policyVersion: number;
      readonly confirmed: boolean;
      readonly correlationId: string;
      readonly message: string;
    }
  | { readonly ok: false; readonly error: string; readonly correlationId: string };

export type AssignVariantSkuDeps = {
  readonly client: SkuClient;
  readonly loadProduct: (productId: string) => Promise<{
    id: string;
    sku: string;
    details: unknown;
    shopifyProductId: string | null;
    variants: Array<{
      id: string;
      sku: string;
      shopifyVariantId: string | null;
    }>;
  } | null>;
  readonly externalShop: string;
  readonly writeShopifySku?: typeof writeShopifyVariantSku;
  readonly persistLocalSku: (input: {
    productId: string;
    variantId: string | null;
    sku: string;
    details: Record<string, unknown>;
  }) => Promise<{ variantId: string }>;
  readonly clearPendingAndKeepSku?: (input: {
    productId: string;
    details: Record<string, unknown>;
  }) => Promise<void>;
};

/**
 * preview → reserve → (Shopify write → read-back → confirm) when linked;
 * otherwise reserve → local SKU + pending reservation for confirm-on-push.
 */
export async function assignVariantSku(
  input: AssignVariantSkuInput,
  deps: AssignVariantSkuDeps,
): Promise<AssignVariantSkuResult> {
  const correlationId = input.correlationId ?? randomUUID();
  const idempotencyKey = input.idempotencyKey ?? `sku-assign:${input.productId}:${input.familyKey}`;
  const product = await deps.loadProduct(input.productId);
  if (!product) {
    return { ok: false, error: "Product not found", correlationId };
  }

  const existingPending = readPendingSkuReservation(product.details);
  if (existingPending) {
    return {
      ok: false,
      error: `A reservation is already pending for ${existingPending.sku}. Finish Push/confirm or recover before reserving again.`,
      correlationId,
    };
  }

  const primarySku = product.variants[0]?.sku ?? product.sku;
  if (!isPendingCommerceSku(primarySku)) {
    return {
      ok: false,
      error: `Variant already has SKU ${primarySku}. External Shopify edits need conflict review, not a second reservation.`,
      correlationId,
    };
  }

  const reserve = await deps.client.reserve(
    { familyKey: input.familyKey, correlationId },
    idempotencyKey,
  );
  if (!reserve.ok) {
    return { ok: false, error: reserve.error.message, correlationId };
  }

  const reserved = reserve.value;
  const primary = product.variants[0] ?? null;
  const shopifyProductId = product.shopifyProductId;
  const shopifyVariantId = primary?.shopifyVariantId ?? null;
  const writeShopify = deps.writeShopifySku ?? writeShopifyVariantSku;

  if (shopifyProductId && shopifyVariantId) {
    const written = await writeShopify({
      shopifyProductId,
      shopifyVariantId,
      sku: reserved.sku,
    });
    if (!written.ok) {
      const pending: PendingSkuReservation = {
        reservationId: reserved.reservationId,
        sku: reserved.sku,
        familyKey: reserved.familyKey,
        correlationId: reserved.correlationId,
        idempotencyKey,
        localVariantId: primary?.id ?? null,
      };
      await deps.persistLocalSku({
        productId: product.id,
        variantId: primary?.id ?? null,
        sku: reserved.sku,
        details: withPendingSkuReservation(product.details, pending),
      });
      return {
        ok: false,
        error: written.error,
        correlationId: reserved.correlationId,
      };
    }

    const confirmed = await deps.client.confirmAssignment({
      reservationId: reserved.reservationId,
      sku: reserved.sku,
      externalSystem: "shopify",
      externalShop: deps.externalShop,
      externalProductId: shopifyProductId,
      externalVariantId: shopifyVariantId,
      shopifyReadBackSku: written.readBackSku,
      correlationId: reserved.correlationId,
    });
    if (!confirmed.ok) {
      const pending: PendingSkuReservation = {
        reservationId: reserved.reservationId,
        sku: reserved.sku,
        familyKey: reserved.familyKey,
        correlationId: reserved.correlationId,
        idempotencyKey,
        localVariantId: primary?.id ?? null,
      };
      await deps.persistLocalSku({
        productId: product.id,
        variantId: primary?.id ?? null,
        sku: reserved.sku,
        details: withPendingSkuReservation(product.details, pending),
      });
      return {
        ok: false,
        error: confirmed.error.message,
        correlationId: reserved.correlationId,
      };
    }

    await deps.persistLocalSku({
      productId: product.id,
      variantId: primary?.id ?? null,
      sku: reserved.sku,
      details: withoutPendingSkuReservation(product.details),
    });

    return {
      ok: true,
      sku: reserved.sku,
      reservationId: reserved.reservationId,
      assignmentId: confirmed.value.assignmentId,
      policyVersion: confirmed.value.policyVersion,
      confirmed: true,
      correlationId: reserved.correlationId,
      message: `Assigned ${reserved.sku} and confirmed against Shopify read-back.`,
    };
  }

  const pending: PendingSkuReservation = {
    reservationId: reserved.reservationId,
    sku: reserved.sku,
    familyKey: reserved.familyKey,
    correlationId: reserved.correlationId,
    idempotencyKey,
    localVariantId: primary?.id ?? null,
  };
  await deps.persistLocalSku({
    productId: product.id,
    variantId: primary?.id ?? null,
    sku: reserved.sku,
    details: withPendingSkuReservation(product.details, pending),
  });

  return {
    ok: true,
    sku: reserved.sku,
    reservationId: reserved.reservationId,
    assignmentId: null,
    policyVersion: reserved.policyVersion,
    confirmed: false,
    correlationId: reserved.correlationId,
    message: `Reserved ${reserved.sku}. Push to Shopify to write + confirm (or link variant first).`,
  };
}

export type ConfirmPendingAfterPushInput = {
  readonly productId: string;
  readonly shopifyProductId: string;
  readonly shopifyVariantId: string;
  readonly shopifyReadBackSku: string;
};

/**
 * After Push writes a reserved SKU and read-back matches, confirm the ledger.
 */
export async function confirmPendingSkuAfterShopifyWrite(
  input: ConfirmPendingAfterPushInput,
  deps: Pick<AssignVariantSkuDeps, "client" | "loadProduct" | "externalShop" | "persistLocalSku">,
): Promise<{ ok: true; assignmentId: string } | { ok: false; error: string } | { ok: true; skipped: true }> {
  const product = await deps.loadProduct(input.productId);
  if (!product) return { ok: false, error: "Product not found" };
  const pending = readPendingSkuReservation(product.details);
  if (!pending) return { ok: true, skipped: true };
  if (pending.sku !== input.shopifyReadBackSku) {
    return {
      ok: false,
      error: `Pending reservation SKU ${pending.sku} does not match Shopify read-back ${input.shopifyReadBackSku}`,
    };
  }

  const confirmed = await deps.client.confirmAssignment({
    reservationId: pending.reservationId,
    sku: pending.sku,
    externalSystem: "shopify",
    externalShop: deps.externalShop,
    externalProductId: input.shopifyProductId,
    externalVariantId: input.shopifyVariantId,
    shopifyReadBackSku: input.shopifyReadBackSku,
    correlationId: pending.correlationId,
  });
  if (!confirmed.ok) {
    return { ok: false, error: confirmed.error.message };
  }

  await deps.persistLocalSku({
    productId: product.id,
    variantId: pending.localVariantId,
    sku: pending.sku,
    details: withoutPendingSkuReservation(product.details),
  });

  return { ok: true, assignmentId: confirmed.value.assignmentId };
}

export async function previewVariantSku(
  input: { familyKey: string; correlationId?: string },
  client: SkuClient,
) {
  const correlationId = input.correlationId ?? randomUUID();
  return client.preview({ familyKey: input.familyKey, correlationId });
}
