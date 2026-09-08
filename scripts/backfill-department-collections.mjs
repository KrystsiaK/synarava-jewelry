// One-off backfill for Phase A item 3 (storefront navigation migration):
// links every existing product to its primary-nav ("department") collection
// via ProductCollection, using the same classification the storefront used
// to compute departmentSlug on the fly before this migration. Idempotent —
// skips any product that already has a primary-nav membership (e.g. from a
// Shopify collection pull).
import { PrismaClient } from "@prisma/client";
import { classifyDepartment } from "./department-backfill-classifier.mjs";

const prisma = new PrismaClient();

async function main() {
  const navCollections = await prisma.collection.findMany({ where: { isPrimaryNav: true } });
  const navCollectionBySlug = new Map(navCollections.map((collection) => [collection.slug, collection]));
  if (navCollectionBySlug.size === 0) {
    throw new Error("No isPrimaryNav collections found — run the migration before this script.");
  }

  const products = await prisma.product.findMany({
    include: {
      category: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
      collections: { select: { collectionId: true, collection: { select: { isPrimaryNav: true } } } },
    },
  });

  let linked = 0;
  let skippedAlreadyLinked = 0;
  let skippedUnknownDepartment = 0;

  for (const product of products) {
    const alreadyHasNavMembership = product.collections.some((item) => item.collection.isPrimaryNav);
    if (alreadyHasNavMembership) {
      skippedAlreadyLinked += 1;
      continue;
    }

    const departmentSlug = classifyDepartment(product);
    const target = navCollectionBySlug.get(departmentSlug);
    if (!target) {
      skippedUnknownDepartment += 1;
      console.warn(`[backfill] "${product.name}" (${product.id}) classified as "${departmentSlug}", which has no matching primary-nav collection — skipped.`);
      continue;
    }

    await prisma.productCollection.create({
      data: { productId: product.id, collectionId: target.id },
    });
    linked += 1;
  }

  console.log(`[backfill] linked ${linked} product(s), ${skippedAlreadyLinked} already linked, ${skippedUnknownDepartment} skipped (unknown department).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
