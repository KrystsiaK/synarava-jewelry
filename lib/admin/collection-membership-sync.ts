import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Adds/removes a product's membership in the one collection matching
 * `scope`, leaving other collection memberships (and this membership's
 * `sortOrder`, when it already exists) untouched. Every admin save routes
 * department, marketing, and storefront-default membership through this so
 * none of them resets a Shopify collection-priority order to 0.
 */
export async function syncScopedCollectionMembership(
  productId: string,
  scope: Prisma.CollectionWhereInput,
  targetCollectionId: string | null,
) {
  const existing = await db.productCollection.findMany({
    where: { productId, collection: scope },
    select: { id: true, collectionId: true },
  });
  const staleIds = existing
    .filter((item) => item.collectionId !== targetCollectionId)
    .map((item) => item.id);
  if (staleIds.length) {
    await db.productCollection.deleteMany({ where: { id: { in: staleIds } } });
  }
  if (targetCollectionId && !existing.some((item) => item.collectionId === targetCollectionId)) {
    await db.productCollection.create({ data: { productId, collectionId: targetCollectionId } });
  }
}

/** Keeps a product's storefront-navigation membership (its "department") in sync with the admin's department select. */
export async function syncDepartmentCollectionMembership(productId: string, departmentSlug: string) {
  const target = departmentSlug
    ? await db.collection.findFirst({ where: { slug: departmentSlug, isPrimaryNav: true }, select: { id: true } })
    : null;
  await syncScopedCollectionMembership(productId, { isPrimaryNav: true }, target?.id ?? null);
}

/**
 * Keeps a published product a member of the one collection flagged
 * `isStorefrontDefault`, if any — its Shopify manual order drives /shop's
 * default "Featured" sort across the whole catalog (see listShopProducts).
 * Draft/archived products are removed so their stale priority can't leak
 * into that sort once they're unpublished again.
 */
export async function syncStorefrontPriorityMembership(productId: string, isPublished: boolean) {
  const target = isPublished
    ? await db.collection.findFirst({ where: { isStorefrontDefault: true }, select: { id: true } })
    : null;
  await syncScopedCollectionMembership(productId, { isStorefrontDefault: true }, target?.id ?? null);
}
