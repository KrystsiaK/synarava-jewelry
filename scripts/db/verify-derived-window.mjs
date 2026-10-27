#!/usr/bin/env node
/**
 * Read-only gate (ADR-0009): prove canonicalize(derive(columns+extras)) ≡
 * canonicalize(archived workingSnapshot) for every Product / Collection.
 *
 * Requires BOTH archive tables from
 * prisma/migrations/20261026160000_derive_synarava_extras_drop_working_snapshot.
 *
 * Failure modes (exit 1):
 * - Either archive table missing (default; no silent "nothing to verify")
 * - Archive/live row-count mismatch
 * - Any archive row with null workingSnapshot
 * - Any live row without an archive row
 * - Any derive ≠ archive structural diff
 *
 * Output prints only entity IDs and diff paths — never field values.
 *
 * Usage (DATABASE_URL must already be set):
 *   node --import tsx scripts/db/verify-derived-window.mjs
 *
 * Escape hatch (local only): VERIFY_DERIVED_WINDOW_ALLOW_MISSING_ARCHIVES=1
 * skips when both archives are absent (still fails if only one is present).
 */
import { pathToFileURL } from "node:url";

export const PRODUCT_ARCHIVE = "_archive_product_working_snapshot";
export const COLLECTION_ARCHIVE = "_archive_collection_working_snapshot";

export async function tableExists(db, tableName) {
  const rows = await db.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS present`,
    tableName,
  );
  return Boolean(rows?.[0]?.present);
}

/**
 * Missing either archive = failure by default.
 * @returns {{ ok: true } | { ok: false, code: string, missing: string[] }}
 */
export function assertArchivesPresent(hasProductArchive, hasCollectionArchive, {
  allowMissingBoth = false,
} = {}) {
  const missing = [];
  if (!hasProductArchive) missing.push(PRODUCT_ARCHIVE);
  if (!hasCollectionArchive) missing.push(COLLECTION_ARCHIVE);
  if (missing.length === 0) return { ok: true };
  if (allowMissingBoth && missing.length === 2) {
    return { ok: false, code: "MISSING_BOTH_SKIPPED", missing };
  }
  return { ok: false, code: "MISSING_ARCHIVE", missing };
}

/**
 * Coverage for one entity kind: counts + missing live→archive links + null snapshots.
 * @returns {{ ok: boolean, liveCount: number, archiveCount: number, nullSnapshotIds: string[], missingArchiveIds: string[] }}
 */
export function evaluateArchiveCoverage({ liveIds, archiveRows }) {
  const liveCount = liveIds.length;
  const archiveCount = archiveRows.length;
  const archiveById = new Map(
    archiveRows.map((row) => [row.id, row.workingSnapshot]),
  );
  const nullSnapshotIds = [];
  for (const row of archiveRows) {
    if (row.workingSnapshot == null) nullSnapshotIds.push(row.id);
  }
  const missingArchiveIds = [];
  for (const id of liveIds) {
    if (!archiveById.has(id)) missingArchiveIds.push(id);
  }
  const ok = liveCount === archiveCount
    && nullSnapshotIds.length === 0
    && missingArchiveIds.length === 0;
  return {
    ok,
    liveCount,
    archiveCount,
    nullSnapshotIds,
    missingArchiveIds,
  };
}

/** Paths only — never local/shopify display values. */
export function pathOnlySamples(diffs, { limit = 8 } = {}) {
  return diffs.slice(0, limit).map((d) => d.path || d.field || "(unnamed)");
}

/**
 * Structural compare after canonicalize (via diffShopifyProjections).
 * @returns {{ identical: boolean, paths: string[] }}
 */
export function compareCanonicalWindows(derived, archived, diffShopifyProjections) {
  const diffs = diffShopifyProjections(derived, archived);
  return {
    identical: diffs.length === 0,
    paths: pathOnlySamples(diffs, { limit: 32 }),
  };
}

function productSelect() {
  return {
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
  };
}

/**
 * @param {object} deps
 * @returns {Promise<{ exitCode: number, report: object }>}
 */
export async function runVerification(deps) {
  const {
    db,
    ourProductWindowFromRow,
    ourCollectionWindowFromRow,
    diffShopifyProjections,
    allowMissingBoth = process.env.VERIFY_DERIVED_WINDOW_ALLOW_MISSING_ARCHIVES === "1",
    log = console,
  } = deps;

  const hasProductArchive = await tableExists(db, PRODUCT_ARCHIVE);
  const hasCollectionArchive = await tableExists(db, COLLECTION_ARCHIVE);
  const archiveGate = assertArchivesPresent(hasProductArchive, hasCollectionArchive, {
    allowMissingBoth,
  });

  if (!archiveGate.ok) {
    if (archiveGate.code === "MISSING_BOTH_SKIPPED") {
      log.log(JSON.stringify({
        status: "skipped",
        reason: "MISSING_BOTH_ARCHIVES",
        missing: archiveGate.missing,
      }));
      return { exitCode: 0, report: { status: "skipped", missing: archiveGate.missing } };
    }
    log.error(JSON.stringify({
      status: "failure",
      reason: "MISSING_ARCHIVE",
      missing: archiveGate.missing,
    }));
    return { exitCode: 1, report: { status: "failure", missing: archiveGate.missing } };
  }

  const failures = [];
  const samples = [];
  let total = 0;
  let identical = 0;
  let differing = 0;

  // --- Products ---
  const products = await db.product.findMany({ select: productSelect() });
  const productArchives = await db.$queryRawUnsafe(
    `SELECT id, "workingSnapshot" FROM "${PRODUCT_ARCHIVE}"`,
  );
  const productCoverage = evaluateArchiveCoverage({
    liveIds: products.map((p) => p.id),
    archiveRows: productArchives,
  });
  if (!productCoverage.ok) {
    failures.push({ kind: "PRODUCT", coverage: {
      liveCount: productCoverage.liveCount,
      archiveCount: productCoverage.archiveCount,
      nullSnapshotIds: productCoverage.nullSnapshotIds,
      missingArchiveIds: productCoverage.missingArchiveIds,
    } });
  }

  const productArchiveById = new Map(
    productArchives.map((row) => [row.id, row.workingSnapshot]),
  );
  if (productCoverage.ok) {
    for (const product of products) {
      const archived = productArchiveById.get(product.id);
      total += 1;
      const derived = ourProductWindowFromRow(product);
      const { identical: ok, paths } = compareCanonicalWindows(
        derived,
        archived,
        diffShopifyProjections,
      );
      if (ok) {
        identical += 1;
        continue;
      }
      differing += 1;
      if (samples.length < 20) {
        samples.push({ kind: "PRODUCT", id: product.id, paths });
      }
    }
  }

  // --- Collections ---
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
  const collectionArchives = await db.$queryRawUnsafe(
    `SELECT id, "workingSnapshot" FROM "${COLLECTION_ARCHIVE}"`,
  );
  const collectionCoverage = evaluateArchiveCoverage({
    liveIds: collections.map((c) => c.id),
    archiveRows: collectionArchives,
  });
  if (!collectionCoverage.ok) {
    failures.push({ kind: "COLLECTION", coverage: {
      liveCount: collectionCoverage.liveCount,
      archiveCount: collectionCoverage.archiveCount,
      nullSnapshotIds: collectionCoverage.nullSnapshotIds,
      missingArchiveIds: collectionCoverage.missingArchiveIds,
    } });
  }

  const collectionArchiveById = new Map(
    collectionArchives.map((row) => [row.id, row.workingSnapshot]),
  );
  if (collectionCoverage.ok) {
    for (const collection of collections) {
      const archived = collectionArchiveById.get(collection.id);
      total += 1;
      const derived = ourCollectionWindowFromRow(collection);
      const { identical: ok, paths } = compareCanonicalWindows(
        derived,
        archived,
        diffShopifyProjections,
      );
      if (ok) {
        identical += 1;
        continue;
      }
      differing += 1;
      if (samples.length < 20) {
        samples.push({ kind: "COLLECTION", id: collection.id, paths });
      }
    }
  }

  const report = {
    status: failures.length > 0 || differing > 0 ? "failure" : "ok",
    coverage: {
      product: {
        liveCount: productCoverage.liveCount,
        archiveCount: productCoverage.archiveCount,
        nullSnapshotCount: productCoverage.nullSnapshotIds.length,
        missingArchiveCount: productCoverage.missingArchiveIds.length,
        nullSnapshotIds: productCoverage.nullSnapshotIds,
        missingArchiveIds: productCoverage.missingArchiveIds,
      },
      collection: {
        liveCount: collectionCoverage.liveCount,
        archiveCount: collectionCoverage.archiveCount,
        nullSnapshotCount: collectionCoverage.nullSnapshotIds.length,
        missingArchiveCount: collectionCoverage.missingArchiveIds.length,
        nullSnapshotIds: collectionCoverage.nullSnapshotIds,
        missingArchiveIds: collectionCoverage.missingArchiveIds,
      },
    },
    total,
    identical,
    differing,
    samples,
  };

  log.log(JSON.stringify(report, null, 2));
  const exitCode = report.status === "ok" ? 0 : 1;
  return { exitCode, report };
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

  try {
    const { exitCode } = await runVerification({
      db,
      ourProductWindowFromRow,
      ourCollectionWindowFromRow,
      diffShopifyProjections,
    });
    await db.$disconnect();
    process.exit(exitCode);
  } catch (error) {
    console.error(error);
    try {
      await db.$disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
