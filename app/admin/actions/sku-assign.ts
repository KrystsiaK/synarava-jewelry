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
} from "@/lib/sku/assign-variant-sku";
import { isPendingCommerceSku } from "@/lib/sku/pending-sku";
import { readPendingSkuReservation } from "@/lib/sku/pending-reservation";

export type SkuAssignContext = {
  configured: boolean;
  reason?: string;
  familyKeys: string[];
  currentSku: string;
  pending: boolean;
  pendingReservationSku: string | null;
  shopifyLinked: boolean;
  variantId: string | null;
};

export type SkuAssignActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  sku?: string;
  confirmed?: boolean;
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
        select: { id: true, sku: true, shopifyVariantId: true },
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
    await tx.product.update({
      where: { id: input.productId },
      data: { sku: input.sku, details },
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

export async function loadSkuAssignContext(productId: string): Promise<SkuAssignContext> {
  await requireAdminSession("/admin/products");
  const config = getSkuServiceConfig();
  const product = await loadProductForSku(productId);
  if (!product) {
    return {
      configured: false,
      reason: "Product not found",
      familyKeys: [],
      currentSku: "",
      pending: true,
      pendingReservationSku: null,
      shopifyLinked: false,
      variantId: null,
    };
  }

  const pendingReservation = readPendingSkuReservation(product.details);
  const primary = product.variants[0] ?? null;
  const currentSku = primary?.sku ?? product.sku;

  if (!config.configured) {
    return {
      configured: false,
      reason: config.reason,
      familyKeys: [],
      currentSku,
      pending: isPendingCommerceSku(currentSku),
      pendingReservationSku: pendingReservation?.sku ?? null,
      shopifyLinked: Boolean(product.shopifyProductId && primary?.shopifyVariantId),
      variantId: primary?.id ?? null,
    };
  }

  const client = tryCreateSkuClient();
  if (!client) {
    return {
      configured: false,
      reason: "SKU client unavailable",
      familyKeys: [],
      currentSku,
      pending: isPendingCommerceSku(currentSku),
      pendingReservationSku: pendingReservation?.sku ?? null,
      shopifyLinked: Boolean(product.shopifyProductId && primary?.shopifyVariantId),
      variantId: primary?.id ?? null,
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
    pending: isPendingCommerceSku(currentSku) || Boolean(pendingReservation),
    pendingReservationSku: pendingReservation?.sku ?? null,
    shopifyLinked: Boolean(product.shopifyProductId && primary?.shopifyVariantId),
    variantId: primary?.id ?? null,
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
}): Promise<SkuAssignActionState> {
  await requireAdminSession("/admin/products");
  const client = tryCreateSkuClient();
  if (!client) {
    return { ok: false, error: "SKU API is not configured on this environment" };
  }

  const product = await loadProductForSku(input.productId);
  const variantId = product?.variants[0]?.id ?? "primary";
  const result = await assignVariantSku(
    {
      productId: input.productId,
      familyKey: input.familyKey,
      correlationId: randomUUID(),
      idempotencyKey: `sku-assign:${input.productId}:${variantId}:${input.familyKey}`,
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
    policyVersion: result.policyVersion,
    correlationId: result.correlationId,
    message: result.message,
  };
}
