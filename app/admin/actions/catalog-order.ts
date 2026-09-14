"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import {
  revalidateStorefrontPath,
  revalidateStorefrontTemplate,
} from "@/lib/content/revalidate-storefront";
import { reorderShopifyCollectionProduct } from "@/lib/shopify/collection-order";

const reorderSchema = z.object({
  collectionId: z.string().trim().min(1),
  productId: z.string().trim().min(1),
  newPosition: z.number().int().min(0),
});

export type CollectionOrderActionState = {
  error?: string;
  success?: string;
  orderedProductIds?: string[];
};

export async function reorderCollectionProductAction(
  input: unknown,
): Promise<CollectionOrderActionState> {
  await requireAdminSession("/admin/products");
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a valid collection position." };

  const membership = await db.productCollection.findUnique({
    where: {
      productId_collectionId: {
        productId: parsed.data.productId,
        collectionId: parsed.data.collectionId,
      },
    },
    include: {
      product: { select: { shopifyProductId: true } },
      collection: { select: { shopifyCollectionId: true } },
    },
  });

  if (!membership?.product.shopifyProductId || !membership.collection.shopifyCollectionId) {
    return { error: "Sync this product and collection with Shopify before changing priority." };
  }

  try {
    const remoteOrder = await reorderShopifyCollectionProduct({
      collectionId: membership.collection.shopifyCollectionId,
      productId: membership.product.shopifyProductId,
      newPosition: parsed.data.newPosition,
    });
    const localProducts = await db.product.findMany({
      where: { shopifyProductId: { in: remoteOrder } },
      select: { id: true, shopifyProductId: true },
    });
    const localIdByShopifyId = new Map(
      localProducts.flatMap((product) => product.shopifyProductId
        ? [[product.shopifyProductId, product.id] as const]
        : []),
    );
    const orderedProductIds = remoteOrder.flatMap((shopifyProductId) => {
      const productId = localIdByShopifyId.get(shopifyProductId);
      return productId ? [productId] : [];
    });

    await db.$transaction(async (tx) => {
      for (const [sortOrder, productId] of orderedProductIds.entries()) {
        await tx.productCollection.upsert({
          where: {
            productId_collectionId: {
              productId,
              collectionId: parsed.data.collectionId,
            },
          },
          create: { productId, collectionId: parsed.data.collectionId, sortOrder },
          update: { sortOrder },
        });
      }
    });

    revalidatePath("/admin/products");
    revalidateStorefrontPath("/shop");
    revalidateStorefrontTemplate("/collections/[slug]");
    return { success: "Collection priority updated in Shopify.", orderedProductIds };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update Shopify collection priority.",
    };
  }
}
