import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export type PersistLocalSkuInput = {
  productId: string;
  variantId: string | null;
  sku: string;
  details: Record<string, unknown>;
};

/**
 * Persist assigned SKU into Prisma columns (ADR-0009).
 * OUR commerce window is derived from columns + extras — no workingSnapshot write-through.
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

  return { variantId };
}
