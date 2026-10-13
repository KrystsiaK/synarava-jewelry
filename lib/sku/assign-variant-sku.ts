import "server-only";

import { randomUUID } from "node:crypto";
import type { SkuClient } from "@synarava/sku-contract";
import {
  listPendingSkuReservations,
  readPendingSkuReservation,
  withPendingSkuReservation,
  withoutPendingSkuReservation,
  type PendingSkuReservation,
} from "@/lib/sku/pending-reservation";
import { isPendingCommerceSku } from "@/lib/sku/pending-sku";
import { readShopifyVariantSku } from "@/lib/sku/read-shopify-variant-sku";
import { writeShopifyVariantSku } from "@/lib/sku/write-shopify-variant-sku";

export type AssignVariantSkuInput = {
  readonly productId: string;
  readonly familyKey: string;
  readonly variantId?: string | null;
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
      readonly resumed?: boolean;
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
      title?: string | null;
      shopifyVariantId: string | null;
    }>;
  } | null>;
  readonly externalShop: string;
  readonly writeShopifySku?: typeof writeShopifyVariantSku;
  readonly readShopifySku?: typeof readShopifyVariantSku;
  readonly persistLocalSku: (input: {
    productId: string;
    variantId: string | null;
    sku: string;
    details: Record<string, unknown>;
  }) => Promise<{ variantId: string }>;
};

function pickVariant(
  product: NonNullable<Awaited<ReturnType<AssignVariantSkuDeps["loadProduct"]>>>,
  variantId?: string | null,
) {
  if (variantId) {
    return product.variants.find((variant) => variant.id === variantId) ?? null;
  }
  return product.variants[0] ?? null;
}

async function confirmReservation(input: {
  client: SkuClient;
  pending: PendingSkuReservation;
  externalShop: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  shopifyReadBackSku: string;
}) {
  return input.client.confirmAssignment({
    reservationId: input.pending.reservationId,
    sku: input.pending.sku,
    externalSystem: "shopify",
    externalShop: input.externalShop,
    externalProductId: input.shopifyProductId,
    externalVariantId: input.shopifyVariantId,
    shopifyReadBackSku: input.shopifyReadBackSku,
    correlationId: input.pending.correlationId,
  });
}

/**
 * Idempotent recovery: pending reservation + Shopify write/read-back → confirm.
 * No new reserve. Safe to retry after timeouts (Éтап 4).
 */
export async function resumePendingSkuAssignment(
  input: { readonly productId: string; readonly variantId?: string | null },
  deps: AssignVariantSkuDeps,
): Promise<AssignVariantSkuResult> {
  const correlationId = randomUUID();
  const product = await deps.loadProduct(input.productId);
  if (!product) {
    return { ok: false, error: "Product not found", correlationId };
  }

  const variant = pickVariant(product, input.variantId);
  const pending = readPendingSkuReservation(product.details, variant?.id ?? input.variantId);
  if (!pending) {
    return {
      ok: false,
      error: "No pending SKU reservation to resume",
      correlationId,
    };
  }

  const shopifyProductId = product.shopifyProductId;
  const shopifyVariantId = variant?.shopifyVariantId ?? null;
  if (!shopifyProductId || !shopifyVariantId) {
    return {
      ok: false,
      error: `Reservation ${pending.sku} is pending. Push/link the variant in Shopify, then retry confirm.`,
      correlationId: pending.correlationId,
    };
  }

  const readShopify = deps.readShopifySku ?? readShopifyVariantSku;
  const writeShopify = deps.writeShopifySku ?? writeShopifyVariantSku;

  const remote = await readShopify({ shopifyProductId, shopifyVariantId });
  if (!remote.ok) {
    return { ok: false, error: remote.error, correlationId: pending.correlationId };
  }

  let readBackSku = remote.sku;
  if (readBackSku !== pending.sku) {
    const written = await writeShopify({
      shopifyProductId,
      shopifyVariantId,
      sku: pending.sku,
    });
    if (!written.ok) {
      return { ok: false, error: written.error, correlationId: pending.correlationId };
    }
    readBackSku = written.readBackSku;
  }

  const confirmed = await confirmReservation({
    client: deps.client,
    pending,
    externalShop: deps.externalShop,
    shopifyProductId,
    shopifyVariantId,
    shopifyReadBackSku: readBackSku,
  });
  if (!confirmed.ok) {
    return {
      ok: false,
      error: confirmed.error.message,
      correlationId: pending.correlationId,
    };
  }

  await deps.persistLocalSku({
    productId: product.id,
    variantId: pending.localVariantId ?? variant?.id ?? null,
    sku: pending.sku,
    details: withoutPendingSkuReservation(product.details, pending.localVariantId ?? variant?.id),
  });

  return {
    ok: true,
    sku: pending.sku,
    reservationId: pending.reservationId,
    assignmentId: confirmed.value.assignmentId,
    policyVersion: confirmed.value.policyVersion,
    confirmed: true,
    correlationId: pending.correlationId,
    resumed: true,
    message: `Confirmed pending ${pending.sku} against Shopify read-back (idempotent resume).`,
  };
}

/**
 * preview → reserve → (Shopify write → read-back → confirm) when linked;
 * otherwise reserve → local SKU + pending reservation for confirm-on-push.
 * If a pending reservation already exists for the variant, resumes instead (no second reserve).
 */
export async function assignVariantSku(
  input: AssignVariantSkuInput,
  deps: AssignVariantSkuDeps,
): Promise<AssignVariantSkuResult> {
  const correlationId = input.correlationId ?? randomUUID();
  const product = await deps.loadProduct(input.productId);
  if (!product) {
    return { ok: false, error: "Product not found", correlationId };
  }

  const variant = pickVariant(product, input.variantId);
  const existingPending = readPendingSkuReservation(product.details, variant?.id ?? input.variantId);
  if (existingPending) {
    return resumePendingSkuAssignment(
      { productId: input.productId, variantId: variant?.id ?? input.variantId },
      deps,
    );
  }

  const variantSku = variant?.sku ?? product.sku;
  if (!isPendingCommerceSku(variantSku)) {
    return {
      ok: false,
      error: `Variant already has SKU ${variantSku}. External Shopify edits need conflict review, not a second reservation.`,
      correlationId,
    };
  }

  const variantKey = variant?.id ?? "primary";
  const idempotencyKey =
    input.idempotencyKey ?? `sku-assign:${input.productId}:${variantKey}:${input.familyKey}`;

  const reserve = await deps.client.reserve(
    { familyKey: input.familyKey, correlationId },
    idempotencyKey,
  );
  if (!reserve.ok) {
    return { ok: false, error: reserve.error.message, correlationId };
  }

  const reserved = reserve.value;
  const shopifyProductId = product.shopifyProductId;
  const shopifyVariantId = variant?.shopifyVariantId ?? null;
  const writeShopify = deps.writeShopifySku ?? writeShopifyVariantSku;

  const pendingBase: PendingSkuReservation = {
    reservationId: reserved.reservationId,
    sku: reserved.sku,
    familyKey: reserved.familyKey,
    correlationId: reserved.correlationId,
    idempotencyKey,
    localVariantId: variant?.id ?? null,
  };

  if (shopifyProductId && shopifyVariantId) {
    const written = await writeShopify({
      shopifyProductId,
      shopifyVariantId,
      sku: reserved.sku,
    });
    if (!written.ok) {
      await deps.persistLocalSku({
        productId: product.id,
        variantId: variant?.id ?? null,
        sku: reserved.sku,
        details: withPendingSkuReservation(product.details, pendingBase),
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
      await deps.persistLocalSku({
        productId: product.id,
        variantId: variant?.id ?? null,
        sku: reserved.sku,
        details: withPendingSkuReservation(product.details, pendingBase),
      });
      return {
        ok: false,
        error: confirmed.error.message,
        correlationId: reserved.correlationId,
      };
    }

    await deps.persistLocalSku({
      productId: product.id,
      variantId: variant?.id ?? null,
      sku: reserved.sku,
      details: withoutPendingSkuReservation(product.details, variant?.id),
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

  await deps.persistLocalSku({
    productId: product.id,
    variantId: variant?.id ?? null,
    sku: reserved.sku,
    details: withPendingSkuReservation(product.details, pendingBase),
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
  readonly localVariantId?: string | null;
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

  const pending =
    readPendingSkuReservation(product.details, input.localVariantId)
    ?? listPendingSkuReservations(product.details).find((item) => item.sku === input.shopifyReadBackSku)
    ?? null;
  if (!pending) return { ok: true, skipped: true };
  if (pending.sku !== input.shopifyReadBackSku) {
    return {
      ok: false,
      error: `Pending reservation SKU ${pending.sku} does not match Shopify read-back ${input.shopifyReadBackSku}`,
    };
  }

  const confirmed = await confirmReservation({
    client: deps.client,
    pending,
    externalShop: deps.externalShop,
    shopifyProductId: input.shopifyProductId,
    shopifyVariantId: input.shopifyVariantId,
    shopifyReadBackSku: input.shopifyReadBackSku,
  });
  if (!confirmed.ok) {
    return { ok: false, error: confirmed.error.message };
  }

  await deps.persistLocalSku({
    productId: product.id,
    variantId: pending.localVariantId,
    sku: pending.sku,
    details: withoutPendingSkuReservation(product.details, pending.localVariantId),
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
