import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { writeThroughLocalCommerceToProjection } from "@/lib/shopify/shopify-projection-diff";

export type PersistLocalSkuInput = {
  productId: string;
  variantId: string | null;
  sku: string;
  details: Record<string, unknown>;
};

/**
 * Persist assigned SKU into Prisma view columns **and** write-through into the
 * commerce compare SoT (`workingSnapshot` + OUR store slice).
 *
 * Column-only SKU writes are invisible to `inspectProductSyncState` (deep-diff
 * of windows), so conflict chips stay stale until this path runs — same
 * contract as product Save (`docs/wiki/commerce-sync.md`).
 */
export async function persistLocalSku(
  input: PersistLocalSkuInput,
): Promise<{ variantId: string }> {
  const details = input.details as Prisma.InputJsonValue;
  const { variantId } = await db.$transaction(async (tx) => {
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

  await writeThroughAssignedSkuToWorkingSnapshot({
    productId: input.productId,
    variantId,
    sku: input.sku,
  });

  return { variantId };
}

/** Write-through assigned SKU into workingSnapshot + patch OUR dual-store slice. */
export async function writeThroughAssignedSkuToWorkingSnapshot(input: {
  productId: string;
  variantId: string;
  sku: string;
}): Promise<void> {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: {
      shopifyProductId: true,
      workingSnapshot: true,
      shopifySnapshot: true,
      variants: {
        where: { id: input.variantId },
        select: { shopifyVariantId: true },
        take: 1,
      },
    },
  });
  if (!product) return;

  const baseWindow = product.workingSnapshot ?? product.shopifySnapshot ?? {};
  const shopifyVariantId = product.variants[0]?.shopifyVariantId ?? null;
  const nextWorking = writeThroughLocalCommerceToProjection(baseWindow, {
    variant: {
      shopifyVariantId,
      sku: input.sku,
    },
  });

  await db.product.update({
    where: { id: input.productId },
    data: { workingSnapshot: nextWorking as Prisma.InputJsonValue },
  });

  if (product.shopifyProductId) {
    const { patchOurProductWindow } = await import("@/lib/commerce-store/refresh");
    await patchOurProductWindow({
      shopifyProductId: product.shopifyProductId,
      localProductId: input.productId,
      window: nextWorking,
    });
  }
}
