import "server-only";

import { db } from "@/lib/db";

/**
 * Local-only: move ACTIVE/UNLISTED products in this collection to Draft/Private.
 * Does not change Shopify publication or product `syncStatus` — storefront hide
 * only. Also drops storefront-default membership so draft products cannot keep
 * Featured sort priority (same rule as `syncStorefrontPriorityMembership(..., false)`).
 */
export async function draftMemberProductsLocally(collectionId: string): Promise<{
  draftedProductIds: string[];
}> {
  const memberships = await db.productCollection.findMany({
    where: {
      collectionId,
      product: { status: { in: ["ACTIVE", "UNLISTED"] } },
    },
    select: { productId: true },
  });
  const draftedProductIds = [...new Set(memberships.map((row) => row.productId))];
  if (draftedProductIds.length === 0) {
    return { draftedProductIds };
  }

  await db.$transaction([
    db.product.updateMany({
      where: { id: { in: draftedProductIds } },
      data: {
        status: "DRAFT",
        visibility: "PRIVATE",
        publishedAt: null,
      },
    }),
    db.productCollection.deleteMany({
      where: {
        productId: { in: draftedProductIds },
        collection: { isStorefrontDefault: true },
      },
    }),
  ]);

  return { draftedProductIds };
}

export function collectionDraftCascadeNotice(count: number) {
  if (count <= 0) return "";
  if (count === 1) {
    return " 1 member product moved to draft locally (Shopify commerce status unchanged).";
  }
  return ` ${count} member products moved to draft locally (Shopify commerce status unchanged).`;
}
