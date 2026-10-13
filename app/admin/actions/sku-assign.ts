"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
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
import { isPendingCommerceSku } from "@/lib/sku/pending-sku";
import {
  listPendingSkuReservations,
  readPendingSkuReservation,
} from "@/lib/sku/pending-reservation";

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

async function persistLocalSku(input: {
  productId: string;
  variantId: string | null;
  sku: string;
  details: Record<string, unknown>;
}): Promise<{ variantId: string }> {
  const details = input.details as Prisma.InputJsonValue;
  return db.$transaction(async (tx) => {
    const primary = await tx.productVariant.findFirst({
      where: { productId: input.productId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const mirrorsProductSku = !input.variantId || !primary || input.variantId === primary.id;

    await tx.product.update({
      where: { id: input.productId },
      data: {
        ...(mirrorsProductSku ? { sku: input.sku } : {}),
        details,
      },
    });

    if (input.variantId) {
      await tx.productVariant.update({
        where: { id: input.variantId },
        data: { sku: input.sku },
      });
      return { variantId: input.variantId };
    }

    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
      select: { priceCents: true, compareAtCents: true, status: true },
    });
    const created = await tx.productVariant.create({
      data: {
        productId: input.productId,
        sku: input.sku,
        title: "Default Title",
        priceCents: product.priceCents,
        compareAtCents: product.compareAtCents,
        status: product.status,
      },
      select: { id: true },
    });
    return { variantId: created.id };
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
    return {
      variantId: variant.id,
      title: variant.title || "Default Title",
      sku: variant.sku,
      shopifyVariantId: variant.shopifyVariantId,
      pending: isPendingCommerceSku(variant.sku) || Boolean(pending),
      pendingReservationSku: pending?.sku ?? null,
      shopifyLinked: Boolean(product.shopifyProductId && variant.shopifyVariantId),
    };
  });
}

export async function loadSkuAssignContext(productId: string): Promise<SkuAssignContext> {
  await requireAdminSession("/admin/products");
  const config = getSkuServiceConfig();
  const product = await loadProductForSku(productId);
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
  await requireAdminSession("/admin/products");
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

  if (!result.ok) {
    revalidatePath(`/admin/products/${input.productId}`);
    return { ok: false, error: result.error, correlationId: result.correlationId };
  }

  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/admin/products");
  return {
    ok: true,
    sku: result.sku,
    confirmed: result.confirmed,
    resumed: result.resumed,
    policyVersion: result.policyVersion,
    correlationId: result.correlationId,
    message: result.message,
  };
}

export async function resumePendingSkuAction(input: {
  productId: string;
  variantId?: string | null;
}): Promise<SkuAssignActionState> {
  await requireAdminSession("/admin/products");
  const client = tryCreateSkuClient();
  if (!client) {
    return { ok: false, error: "SKU API is not configured on this environment" };
  }

  const result = await resumePendingSkuAssignment(
    { productId: input.productId, variantId: input.variantId },
    {
      client,
      externalShop: externalShopDomain(),
      loadProduct: loadProductForSku,
      persistLocalSku,
    },
  );

  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/admin/products");
  if (!result.ok) {
    return { ok: false, error: result.error, correlationId: result.correlationId };
  }
  return {
    ok: true,
    sku: result.sku,
    confirmed: result.confirmed,
    resumed: true,
    policyVersion: result.policyVersion,
    correlationId: result.correlationId,
    message: result.message,
  };
}
