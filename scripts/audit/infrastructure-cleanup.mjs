/**
 * Infrastructure cleanup after audit confirmation (test-mode hygiene).
 *
 * Policy: keep local media that is actually used (pages, collection heroes,
 * product locals when imageUrl is NOT already on Shopify CDN). Do not keep
 * bucket duplicates of images that Shopify already serves — storage costs money.
 *
 * Default: dry-run. Apply with --execute.
 *
 * Actions:
 * 1. Shopify-linked products with CDN imageUrl: detach local primary + all
 *    ProductMedia for that product (local files become deletable orphans).
 * 2. Delete MediaAsset + S3 object when not referenced by FK or JSON content.
 *    Keeps collection hero/cover and Page/Section JSON-referenced keys.
 * 3. Delete ShopifyCustomerSession rows with expired access tokens.
 *
 * Legacy table/column drops live in prisma/migrations (separate).
 *
 *   DATABASE_URL="$DATABASE_PUBLIC_URL" node scripts/audit/infrastructure-cleanup.mjs
 *   DATABASE_URL="$DATABASE_PUBLIC_URL" node scripts/audit/infrastructure-cleanup.mjs --execute
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXECUTE = process.argv.includes("--execute");
const OUT = path.join(__dirname, "infrastructure-cleanup-results.json");

if (!process.env.DATABASE_URL && process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

function walk(value, visit) {
  if (typeof value === "string") visit(value);
  else if (Array.isArray(value)) for (const item of value) walk(item, visit);
  else if (value && typeof value === "object") for (const item of Object.values(value)) walk(item, visit);
}

function collectUploadKeys(value, into) {
  walk(value, (s) => {
    const matches = s.match(/uploads\/(?:products|collections|pages|videos)\/[^\s"'\\?]+/g);
    if (matches) for (const m of matches) into.add(decodeURIComponent(m));
    if (s.startsWith("/media/uploads/")) {
      into.add(decodeURIComponent(s.slice("/media/".length).split("?")[0]));
    }
  });
}

function resolveS3() {
  if (!process.env.S3_REGION || !process.env.S3_BUCKET) {
    throw new Error("S3 is not configured.");
  }
  const endpoint = process.env.S3_ENDPOINT ?? null;
  const forcePathStyle =
    process.env.S3_FORCE_PATH_STYLE === "true"
      ? true
      : process.env.S3_FORCE_PATH_STYLE === "false"
        ? false
        : Boolean(endpoint);
  return {
    bucket: process.env.S3_BUCKET,
    client: new S3Client({
      region: process.env.S3_REGION,
      endpoint: endpoint ?? undefined,
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
      forcePathStyle,
    }),
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const prisma = new PrismaClient({ log: ["error"] });
  const { bucket, client: s3 } = resolveS3();
  const report = {
    mode: EXECUTE ? "execute" : "dry-run",
    startedAt: new Date().toISOString(),
    hybridsCleared: [],
    orphanDeletes: [],
    sessionsDeleted: [],
    errors: [],
  };

  try {
    const [
      assets,
      products,
      collections,
      productMedia,
      pages,
      pageTranslations,
      sections,
    ] = await Promise.all([
      prisma.mediaAsset.findMany({
        select: { id: true, key: true, status: true, filename: true, sizeBytes: true },
      }),
      prisma.product.findMany({
        select: {
          id: true,
          slug: true,
          imageUrl: true,
          primaryAssetId: true,
          shopifyProductId: true,
        },
      }),
      prisma.collection.findMany({
        select: { id: true, heroAssetId: true, coverAssetId: true },
      }),
      prisma.productMedia.findMany({
        select: { id: true, productId: true, assetId: true },
      }),
      prisma.page.findMany({ select: { content: true } }),
      prisma.pageTranslation.findMany({ select: { content: true } }),
      prisma.collectionSection.findMany({ select: { content: true } }),
    ]);

    const jsonKeys = new Set();
    for (const page of pages) collectUploadKeys(page.content, jsonKeys);
    for (const row of pageTranslations) collectUploadKeys(row.content, jsonKeys);
    for (const row of sections) collectUploadKeys(row.content, jsonKeys);

    // 1) Detach local product media that duplicates Shopify CDN imageUrl
    const shopifyCdnProducts = products.filter(
      (p) =>
        p.shopifyProductId &&
        typeof p.imageUrl === "string" &&
        /cdn\.shopify\.com/i.test(p.imageUrl) &&
        (p.primaryAssetId || productMedia.some((pm) => pm.productId === p.id)),
    );

    const detachedProductIds = new Set();
    const detachedAssetIds = new Set();

    for (const product of shopifyCdnProducts) {
      const mediaRows = productMedia.filter((pm) => pm.productId === product.id);
      for (const row of mediaRows) detachedAssetIds.add(row.assetId);
      if (product.primaryAssetId) detachedAssetIds.add(product.primaryAssetId);
      detachedProductIds.add(product.id);
      report.hybridsCleared.push({
        productId: product.id,
        slug: product.slug,
        primaryAssetId: product.primaryAssetId,
        productMediaIds: mediaRows.map((m) => m.id),
        assetIdsDetached: [...new Set([
          ...mediaRows.map((m) => m.assetId),
          ...(product.primaryAssetId ? [product.primaryAssetId] : []),
        ])],
      });
      if (EXECUTE) {
        await prisma.$transaction([
          prisma.productMedia.deleteMany({ where: { productId: product.id } }),
          prisma.product.update({
            where: { id: product.id },
            data: { primaryAssetId: null },
          }),
        ]);
      }
    }

    // FK refs after detach: keep collection heroes/covers + remaining product links
    const fkRefs = new Set([
      ...products
        .filter((p) => p.primaryAssetId && !detachedProductIds.has(p.id))
        .map((p) => p.primaryAssetId),
      ...productMedia
        .filter((pm) => !detachedProductIds.has(pm.productId))
        .map((pm) => pm.assetId),
      ...collections.flatMap((c) => [c.heroAssetId, c.coverAssetId].filter(Boolean)),
    ]);
    for (const id of detachedAssetIds) fkRefs.delete(id);

    const orphans = assets.filter((a) => !fkRefs.has(a.id) && !jsonKeys.has(a.key));

    for (const asset of orphans) {
      const entry = { id: asset.id, key: asset.key, status: asset.status };
      report.orphanDeletes.push(entry);
      if (!EXECUTE) continue;
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: asset.key }));
        await prisma.mediaAsset.delete({ where: { id: asset.id } });
        entry.deleted = true;
      } catch (error) {
        entry.deleted = false;
        entry.error = error?.message?.slice(0, 200) ?? "unknown";
        report.errors.push({ assetId: asset.id, key: asset.key, error: entry.error });
      }
    }

    // 3) Expired customer access tokens (test hygiene)
    const now = new Date();
    const expiredSessions = await prisma.shopifyCustomerSession.findMany({
      where: { accessTokenExpiresAt: { lt: now } },
      select: { id: true, accessTokenExpiresAt: true, sessionExpiresAt: true },
    });
    for (const session of expiredSessions) {
      report.sessionsDeleted.push(session);
      if (EXECUTE) {
        await prisma.shopifyCustomerSession.delete({ where: { id: session.id } });
      }
    }

    report.finishedAt = new Date().toISOString();
    report.counts = {
      hybridsCleared: report.hybridsCleared.length,
      orphanDeletes: report.orphanDeletes.length,
      sessionsDeleted: report.sessionsDeleted.length,
      errors: report.errors.length,
      jsonProtectedAssets: assets.filter((a) => jsonKeys.has(a.key)).length,
    };

    await writeFile(
      OUT,
      JSON.stringify(
        {
          ...report,
          meta: { bucketRedacted: true, sampleOrphans: report.orphanDeletes.slice(0, 20) },
        },
        null,
        2,
      ),
      "utf8",
    );

    console.log(
      JSON.stringify(
        {
          mode: report.mode,
          counts: report.counts,
          hybrids: report.hybridsCleared.map((h) => h.slug),
          orphanPrefixes: report.orphanDeletes.reduce((acc, row) => {
            const prefix = row.key.split("/").slice(0, 2).join("/");
            acc[prefix] = (acc[prefix] || 0) + 1;
            return acc;
          }, {}),
          wrote: OUT,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
