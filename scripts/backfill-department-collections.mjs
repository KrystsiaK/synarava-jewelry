// One-off backfill for Phase A item 3 (storefront navigation migration):
// links every existing product to its primary-nav ("department") collection
// via ProductCollection, using the same classification the storefront used
// to compute departmentSlug on the fly before this migration. Idempotent —
// skips any product that already has a primary-nav membership (e.g. from a
// Shopify collection pull).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function classifyDepartment(product) {
  const explicit = typeof product.details?.department === "string" ? product.details.department.trim() : "";
  if (explicit) return explicit;

  const classificationText = [
    product.shopifyCategoryName,
    product.name,
    product.seriesLabel,
    product.category?.name,
    ...product.tags.map((entry) => entry.tag.name),
  ].filter(Boolean).join(" ").toLowerCase();

  if (/\b(pet|pets|dog|dogs|cat|cats)\b/.test(classificationText)) return "pets";
  if (/\b(kid|kids|child|children|toy|toys)\b/.test(classificationText)) return "kids";
  if (/\b(bead|beads|findings|jewelry making|jewellery making|craft tools?)\b/.test(classificationText)) return "jewelry-making";
  return "jewelry";
}

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
