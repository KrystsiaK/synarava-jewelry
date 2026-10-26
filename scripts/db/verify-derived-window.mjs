#!/usr/bin/env node
/**
 * Read-only gate (ADR-0009): prove canonicalize(derive(columns+extras)) ≡
 * canonicalize(archived workingSnapshot) for every Product / Collection.
 *
 * Requires archive tables from
 * prisma/migrations/20261026160000_derive_synarava_extras_drop_working_snapshot.
 *
 * Usage (DATABASE_URL must already be set):
 *   node --import tsx scripts/db/verify-derived-window.mjs
 *
 * Exit 1 when any entity differs (CI / operator failure). Exit 0 when identical
 * or when archives are absent (skip with a clear message).
 */
import { pathToFileURL } from "node:url";

async function tableExists(db, tableName) {
  const rows = await db.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS present`,
    tableName,
  );
  return Boolean(rows?.[0]?.present);
}

function summarizeDiffs(diffs) {
  const byField = new Map();
  for (const diff of diffs) {
    const key = diff.field || diff.path || "(unnamed)";
    byField.set(key, (byField.get(key) ?? 0) + 1);
  }
  return [...byField.entries()].toSorted((a, b) => a[0].localeCompare(b[0]));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("verify-derived-window: DATABASE_URL is required");
    process.exit(1);
  }

  const { db } = await import("../../lib/db.ts");
  const {
    ourProductWindowFromRow,
    ourCollectionWindowFromRow,
  } = await import("../../lib/sync/our-window-from-row.ts");
  const { diffShopifyProjections } = await import(
    "../../lib/shopify/shopify-projection-diff.ts"
  );

  const productArchive = "_archive_product_working_snapshot";
  const collectionArchive = "_archive_collection_working_snapshot";

  const hasProductArchive = await tableExists(db, productArchive);
  const hasCollectionArchive = await tableExists(db, collectionArchive);

  if (!hasProductArchive) {
    console.log(`skip products: archive table ${productArchive} does not exist`);
  }
  if (!hasCollectionArchive) {
    console.log(`skip collections: archive table ${collectionArchive} does not exist`);
  }
  if (!hasProductArchive && !hasCollectionArchive) {
    console.log("verify-derived-window: nothing to verify (no archives)");
    await db.$disconnect();
    process.exit(0);
  }

  let total = 0;
  let identical = 0;
  let differing = 0;
  const fieldCounts = new Map();
  const sampleDiffs = [];

  if (hasProductArchive) {
    const products = await db.product.findMany({
      select: {
        id: true,
        extras: true,
        shopifySnapshot: true,
        shopifyProductId: true,
        name: true,
        slug: true,
        description: true,
        vendor: true,
        productType: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        shopifyCategoryId: true,
        shopifyCategoryName: true,
        tags: { select: { tag: { select: { name: true } } } },
        collections: {
          select: {
            collection: {
              select: { shopifyCollectionId: true, slug: true, name: true },
            },
          },
        },
        variants: {
          orderBy: { createdAt: "asc" },
          select: {
            shopifyVariantId: true,
            sku: true,
            title: true,
            barcode: true,
            priceCents: true,
            compareAtCents: true,
            inventoryPolicy: true,
            stockOnHand: true,
            taxable: true,
            selectedOptions: true,
            shopifyInventoryItemId: true,
            requiresShipping: true,
            tracked: true,
            costCents: true,
            weightGrams: true,
          },
        },
      },
    });
    const archives = await db.$queryRawUnsafe(
      `SELECT id, "workingSnapshot" FROM "${productArchive}"`,
    );
    const archiveById = new Map(archives.map((row) => [row.id, row.workingSnapshot]));

    for (const product of products) {
      const archived = archiveById.get(product.id);
      if (archived == null) continue;
      total += 1;
      const derived = ourProductWindowFromRow(product);
      const diffs = diffShopifyProjections(derived, archived);
      if (diffs.length === 0) {
        identical += 1;
        continue;
      }
      differing += 1;
      for (const [field, count] of summarizeDiffs(diffs)) {
        fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + count);
      }
      if (sampleDiffs.length < 20) {
        sampleDiffs.push({
          kind: "PRODUCT",
          id: product.id,
          diffs: diffs.slice(0, 8).map((d) => ({ path: d.path, field: d.field })),
        });
      }
    }
  }

  if (hasCollectionArchive) {
    const collections = await db.collection.findMany({
      select: {
        id: true,
        extras: true,
        shopifySnapshot: true,
        shopifyCollectionId: true,
        name: true,
        slug: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
      },
    });
    const archives = await db.$queryRawUnsafe(
      `SELECT id, "workingSnapshot" FROM "${collectionArchive}"`,
    );
    const archiveById = new Map(archives.map((row) => [row.id, row.workingSnapshot]));

    for (const collection of collections) {
      const archived = archiveById.get(collection.id);
      if (archived == null) continue;
      total += 1;
      const derived = ourCollectionWindowFromRow(collection);
      const diffs = diffShopifyProjections(derived, archived);
      if (diffs.length === 0) {
        identical += 1;
        continue;
      }
      differing += 1;
      for (const [field, count] of summarizeDiffs(diffs)) {
        fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + count);
      }
      if (sampleDiffs.length < 20) {
        sampleDiffs.push({
          kind: "COLLECTION",
          id: collection.id,
          diffs: diffs.slice(0, 8).map((d) => ({ path: d.path, field: d.field })),
        });
      }
    }
  }

  console.log(JSON.stringify({
    total,
    identical,
    differing,
    perFieldDiffCounts: Object.fromEntries(
      [...fieldCounts.entries()].toSorted((a, b) => a[0].localeCompare(b[0])),
    ),
    samples: sampleDiffs,
  }, null, 2));

  await db.$disconnect();
  process.exit(differing > 0 ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error) => {
    console.error(error);
    try {
      const { db } = await import("../../lib/db.ts");
      await db.$disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });
}
