"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { tryCreateSkuClient } from "@/lib/sku/client";
import { getSkuServiceConfig } from "@/lib/sku/config";
import {
  assignVariantSku,
  previewVariantSku,
  resumePendingSkuAssignment,
} from "@/lib/sku/assign-variant-sku";
import { persistLocalSku } from "@/lib/sku/persist-local-sku";
import {
  isPendingCommerceSku,
  isShopifyInventPlaceholderSku,
  localSkuForEmptyShopifySku,
} from "@/lib/sku/pending-sku";
import {
  listPendingSkuReservations,
  readPendingSkuReservation,
} from "@/lib/sku/pending-reservation";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { runAfterSaveCatalogConflictCheck } from "@/lib/shopify/after-save-catalog-check";

export type SkuAssignVariantRow = {
  variantId: string;
  title: string;
  sku: string;
  shopifyVariantId: string | null;
  pending: boolean;
  pendingReservationSku: string | null;
  shopifyLinked: boolean;
};

export type SkuAssignContext = {
  configured: boolean;
  reason?: string;
  familyKeys: string[];
  currentSku: string;
  pending: boolean;
  pendingReservationSku: string | null;
  shopifyLinked: boolean;
  variantId: string | null;
  variants: SkuAssignVariantRow[];
};

export type SkuAssignActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  warning?: string;
  sku?: string;
  confirmed?: boolean;
  resumed?: boolean;
  policyVersion?: number;
  correlationId?: string;
};

async function loadProductForSku(productId: string) {
  return db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      sku: true,
      details: true,
      shopifyProductId: true,
      variants: {
        orderBy: { createdAt: "asc" },
        select: { id: true, sku: true, title: true, shopifyVariantId: true },
      },
    },
  });
}

function externalShopDomain(): string {
  return env.SHOPIFY_STORE_DOMAIN ?? "unknown.myshopify.com";
}

function variantRows(
  product: NonNullable<Awaited<ReturnType<typeof loadProductForSku>>>,
): SkuAssignVariantRow[] {
  return product.variants.map((variant) => {
    const pending = readPendingSkuReservation(product.details, variant.id);
    const needsAssign = isPendingCommerceSku(variant.sku) || Boolean(pending);
    return {
      variantId: variant.id,
      title: variant.title || "Default Title",
      sku: variant.sku,
      shopifyVariantId: variant.shopifyVariantId,
      pending: needsAssign,
      pendingReservationSku: pending?.sku ?? null,
      shopifyLinked: Boolean(product.shopifyProductId && variant.shopifyVariantId),
    };
  });
}

/**
 * Rewrite legacy Pull invent `SHOPIFY-*` → `PENDING-p…-v…` so Inventory never
 * displays a synthetic SKU as if it were assigned (M2).
 */
async function rewriteShopifyInventPlaceholders(
  product: NonNullable<Awaited<ReturnType<typeof loadProductForSku>>>,
): Promise<NonNullable<Awaited<ReturnType<typeof loadProductForSku>>>> {
  if (!product.shopifyProductId) return product;
  let changed = false;
  let nextProductSku = product.sku;
  const primaryId = product.variants[0]?.id ?? null;

  for (const variant of product.variants) {
    if (!isShopifyInventPlaceholderSku(variant.sku)) continue;
    const nextSku = localSkuForEmptyShopifySku({
      shopifyProductId: product.shopifyProductId,
      shopifyVariantId: variant.shopifyVariantId,
    });
    if (nextSku === variant.sku) continue;
    await db.productVariant.update({
      where: { id: variant.id },
      data: { sku: nextSku },
    });
    if (variant.id === primaryId || isShopifyInventPlaceholderSku(nextProductSku)) {
      nextProductSku = nextSku;
    }
    changed = true;
  }

  if (isShopifyInventPlaceholderSku(product.sku) && product.shopifyProductId) {
    const nextSku = localSkuForEmptyShopifySku({
      shopifyProductId: product.shopifyProductId,
      shopifyVariantId: product.variants[0]?.shopifyVariantId ?? null,
    });
    if (nextSku !== product.sku) {
      nextProductSku = nextSku;
      changed = true;
    }
  }

  if (!changed) return product;

  if (nextProductSku !== product.sku) {
    await db.product.update({
      where: { id: product.id },
      data: { sku: nextProductSku },
    });
  }

  const reloaded = await loadProductForSku(product.id);
  return reloaded ?? product;
}

export async function loadSkuAssignContext(productId: string): Promise<SkuAssignContext> {
  await requireAdminSession("/admin/products");
  const config = getSkuServiceConfig();
  const loaded = await loadProductForSku(productId);
  const product = loaded ? await rewriteShopifyInventPlaceholders(loaded) : null;
  const empty: SkuAssignContext = {
    configured: false,
    reason: "Product not found",
    familyKeys: [],
    currentSku: "",
    pending: true,
    pendingReservationSku: null,
    shopifyLinked: false,
    variantId: null,
    variants: [],
  };
  if (!product) return empty;

  const variants = variantRows(product);
  const primary = variants[0] ?? null;
  const anyPending = listPendingSkuReservations(product.details);
  const currentSku = primary?.sku ?? product.sku;

  if (!config.configured) {
    return {
      configured: false,
      reason: config.reason,
      familyKeys: [],
      currentSku,
      pending: primary?.pending ?? isPendingCommerceSku(currentSku),
      pendingReservationSku: primary?.pendingReservationSku ?? anyPending[0]?.sku ?? null,
      shopifyLinked: Boolean(primary?.shopifyLinked),
      variantId: primary?.variantId ?? null,
      variants,
    };
  }

  const client = tryCreateSkuClient();
  if (!client) {
    return {
      configured: false,
      reason: "SKU client unavailable",
      familyKeys: [],
      currentSku,
      pending: primary?.pending ?? true,
      pendingReservationSku: primary?.pendingReservationSku ?? null,
      shopifyLinked: Boolean(primary?.shopifyLinked),
      variantId: primary?.variantId ?? null,
      variants,
    };
  }

  const profiles = await client.listProfiles();
  const published = profiles.ok
    ? profiles.value.profiles.find((profile) => profile.status === "PUBLISHED")
      ?? profiles.value.profiles[0]
    : null;
  const families = published
    ? ((published.config as { families?: Record<string, string> }).families ?? {})
    : {};

  return {
    configured: true,
    familyKeys: Object.keys(families).sort(),
    currentSku,
    pending: primary?.pending ?? Boolean(anyPending.length),
    pendingReservationSku: primary?.pendingReservationSku ?? anyPending[0]?.sku ?? null,
    shopifyLinked: Boolean(primary?.shopifyLinked),
    variantId: primary?.variantId ?? null,
    variants,
  };
}

export async function previewProductSkuAction(input: {
  productId: string;
  familyKey: string;
}): Promise<SkuAssignActionState & {
  previewSku?: string;
  stem?: string;
  sequence?: number;
  provisional?: boolean;
}> {
  await requireAdminSession("/admin/products");
  const client = tryCreateSkuClient();
  if (!client) {
    return { ok: false, error: "SKU API is not configured on this environment" };
  }
  const result = await previewVariantSku({ familyKey: input.familyKey }, client);
  if (!result.ok) {
    return { ok: false, error: result.error.message, correlationId: result.error.correlationId };
  }
  return {
    ok: true,
    previewSku: result.value.sku,
    stem: result.value.stem,
    sequence: result.value.sequence,
    policyVersion: result.value.policyVersion,
    provisional: result.value.provisional,
    correlationId: result.value.correlationId,
    message: `Preview ${result.value.sku} (policy v${result.value.policyVersion}, provisional)`,
  };
}

export async function assignProductSkuAction(input: {
  productId: string;
  familyKey: string;
  variantId?: string | null;
}): Promise<SkuAssignActionState> {
  const currentUser = await requireAdminSession("/admin/products");
  const client = tryCreateSkuClient();
  if (!client) {
    return { ok: false, error: "SKU API is not configured on this environment" };
  }

  const product = await loadProductForSku(input.productId);
  const variantId = input.variantId ?? product?.variants[0]?.id ?? null;
  const result = await assignVariantSku(
    {
      productId: input.productId,
      familyKey: input.familyKey,
      variantId,
      correlationId: randomUUID(),
      idempotencyKey: `sku-assign:${input.productId}:${variantId ?? "primary"}:${input.familyKey}`,
    },
    {
      client,
      externalShop: externalShopDomain(),
      loadProduct: loadProductForSku,
      persistLocalSku,
    },
  );

  // Invalidate at the write — before scoped recheck (recheck must not gate caches).
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/admin/products");

  let warning: string | undefined;
  if (hasShopifyAdminConfig()) {
    const check = await runAfterSaveCatalogConflictCheck(currentUser.username, {
      kind: "product",
      productId: input.productId,
    });
    warning = check.warning;
  }

  if (!result.ok) {
    return { ok: false, error: result.error, correlationId: result.correlationId, warning };
  }

  return {
    ok: true,
    sku: result.sku,
    confirmed: result.confirmed,
    resumed: result.resumed,
    policyVersion: result.policyVersion,
    correlationId: result.correlationId,
    message: result.message,
    warning,
  };
}

export async function resumePendingSkuAction(input: {
  productId: string;
  variantId?: string | null;
}): Promise<SkuAssignActionState> {
  const currentUser = await requireAdminSession("/admin/products");
  const client = tryCreateSkuClient();
  if (!client) {
    return { ok: false, error: "SKU API is not configured on this environment" };
  }

  await loadProductForSku(input.productId);
  const result = await resumePendingSkuAssignment(
    { productId: input.productId, variantId: input.variantId },
    {
      client,
      externalShop: externalShopDomain(),
      loadProduct: loadProductForSku,
      persistLocalSku,
    },
  );

  // Invalidate at the write — before scoped recheck (recheck must not gate caches).
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/admin/products");

  let warning: string | undefined;
  if (hasShopifyAdminConfig()) {
    const check = await runAfterSaveCatalogConflictCheck(currentUser.username, {
      kind: "product",
      productId: input.productId,
    });
    warning = check.warning;
  }

  if (!result.ok) {
    return { ok: false, error: result.error, correlationId: result.correlationId, warning };
  }
  return {
    ok: true,
    sku: result.sku,
    confirmed: result.confirmed,
    resumed: true,
    policyVersion: result.policyVersion,
    correlationId: result.correlationId,
    warning,
    message: result.message,
  };
}
