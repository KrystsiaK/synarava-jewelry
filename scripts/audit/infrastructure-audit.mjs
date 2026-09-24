/**
 * Read-only Postgres + Railway S3 audit for Synarava media/data integrity.
 * Does not mutate DB or bucket. Writes JSON results next to this script.
 *
 * Usage:
 *   DATABASE_URL="$DATABASE_PUBLIC_URL" node scripts/audit/infrastructure-audit.mjs
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_JSON = path.join(__dirname, "infrastructure-audit-results.json");
const SAMPLE_LIMIT = 20;
const EXPECTED_PREFIXES = ["uploads/products/", "uploads/collections/", "uploads/videos/"];
const KNOWN_SITE_SETTING_KEYS = new Set([
  "site-videos",
  "site-seo-v1",
  "storefront-copy-v1",
  "shopify.store_binding",
]);
const VIDEO_SLOTS = ["homeBeads", "homeModel", "braceletFilm", "materialsFilm"];

if (!process.env.DATABASE_URL && process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

function take(arr, n = SAMPLE_LIMIT) {
  return arr.slice(0, n);
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function resolveS3Config(source = process.env) {
  if (!source.S3_REGION || !source.S3_BUCKET) {
    throw new Error("S3 storage is not fully configured.");
  }
  return {
    region: source.S3_REGION,
    bucket: source.S3_BUCKET,
    endpoint: source.S3_ENDPOINT ?? null,
    publicUrl: source.S3_PUBLIC_URL ?? null,
    accessKeyId: source.S3_ACCESS_KEY_ID ?? null,
    secretAccessKey: source.S3_SECRET_ACCESS_KEY ?? null,
    forcePathStyle:
      source.S3_FORCE_PATH_STYLE === "true"
        ? true
        : source.S3_FORCE_PATH_STYLE === "false"
          ? false
          : Boolean(source.S3_ENDPOINT),
    useProxy: source.S3_USE_PROXY === "true",
  };
}

function getS3PublicUrl(key, config) {
  const normalizedKey = key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  if (config.publicUrl) {
    return `${trimTrailingSlash(config.publicUrl)}/${normalizedKey}`;
  }
  if (config.useProxy) {
    return `/media/${normalizedKey}`;
  }
  if (config.endpoint) {
    return `${trimTrailingSlash(config.endpoint)}/${config.bucket}/${normalizedKey}`;
  }
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${normalizedKey}`;
}

/** Extract storage key from stored URL or raw key. Returns null if unknown shape. */
function extractKeyFromUrl(value, config) {
  if (typeof value !== "string" || !value) return null;
  const raw = value.trim();
  if (raw.startsWith("uploads/")) return raw.split("?")[0];
  if (raw.startsWith("/media/")) {
    return decodeURIComponent(raw.slice("/media/".length).split("?")[0]);
  }
  if (config.publicUrl && raw.startsWith(trimTrailingSlash(config.publicUrl) + "/")) {
    return decodeURIComponent(raw.slice(trimTrailingSlash(config.publicUrl).length + 1).split("?")[0]);
  }
  if (config.endpoint) {
    const prefix = `${trimTrailingSlash(config.endpoint)}/${config.bucket}/`;
    if (raw.startsWith(prefix)) {
      return decodeURIComponent(raw.slice(prefix.length).split("?")[0]);
    }
  }
  const bucketHost = `https://${config.bucket}.s3.`;
  if (raw.startsWith(bucketHost) || raw.includes(`.amazonaws.com/`)) {
    try {
      const u = new URL(raw);
      const parts = u.pathname.replace(/^\//, "").split("/");
      if (parts[0] === config.bucket) return decodeURIComponent(parts.slice(1).join("/"));
      return decodeURIComponent(parts.join("/"));
    } catch {
      return null;
    }
  }
  return null;
}

function walkStrings(value, visit) {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, visit);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walkStrings(item, visit);
  }
}

function classifyForeignUrl(url, config) {
  if (typeof url !== "string" || !url) return null;
  if (url.startsWith("/uploads/")) return "local_uploads_path";
  if (url.startsWith("/media/")) return null;
  if (url.startsWith("uploads/")) return null;
  const key = extractKeyFromUrl(url, config);
  if (key) return null;
  if (/^https?:\/\//i.test(url)) return "foreign_host";
  if (url.startsWith("/")) return "other_relative";
  return "opaque";
}

async function listAllBucketKeys(s3, bucket) {
  const objects = [];
  let ContinuationToken;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken,
        MaxKeys: 1000,
      }),
    );
    for (const item of page.Contents ?? []) {
      if (!item.Key || item.Key.endsWith("/")) continue;
      objects.push({
        key: item.Key,
        size: item.Size ?? null,
        etag: item.ETag ?? null,
        lastModified: item.LastModified ? item.LastModified.toISOString() : null,
      });
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return objects;
}

async function headSample(s3, bucket, keys) {
  const results = [];
  for (const key of keys.slice(0, SAMPLE_LIMIT)) {
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      results.push({
        key,
        contentLength: head.ContentLength ?? null,
        contentType: head.ContentType ?? null,
        ok: true,
      });
    } catch (error) {
      results.push({
        key,
        ok: false,
        errorName: error?.name ?? "Error",
        errorCode: error?.$metadata?.httpStatusCode ?? null,
      });
    }
  }
  return results;
}

function finding(id, title, severity, count, samples, recommendedAction, extra = {}) {
  return {
    id,
    title,
    severity,
    count,
    samples: take(samples),
    recommendedAction,
    ...extra,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL (or DATABASE_PUBLIC_URL) is required.");
  }

  const s3Config = resolveS3Config();
  const bucketName = s3Config.bucket;
  // Never echo secrets / connection strings / full endpoints in results.
  const s3Meta = {
    bucket: bucketName,
    region: s3Config.region,
    hasEndpoint: Boolean(s3Config.endpoint),
    hasPublicUrl: Boolean(s3Config.publicUrl),
    useProxy: s3Config.useProxy,
    forcePathStyle: s3Config.forcePathStyle,
  };

  const prisma = new PrismaClient({ log: ["error"] });
  const s3 = new S3Client({
    region: s3Config.region,
    endpoint: s3Config.endpoint ?? undefined,
    credentials:
      s3Config.accessKeyId && s3Config.secretAccessKey
        ? { accessKeyId: s3Config.accessKeyId, secretAccessKey: s3Config.secretAccessKey }
        : undefined,
    forcePathStyle: s3Config.forcePathStyle,
  });

  const findings = [];
  const notes = [];

  try {
    // ---------- Load media reference graph ----------
    const [
      mediaAssets,
      products,
      variants,
      productMedia,
      collections,
      siteVideosSetting,
      pages,
      pageTranslations,
      collectionSections,
      productTranslations,
    ] = await Promise.all([
      prisma.mediaAsset.findMany({
        select: {
          id: true,
          key: true,
          bucket: true,
          filename: true,
          sizeBytes: true,
          status: true,
          mimeType: true,
        },
      }),
      prisma.product.findMany({
        select: {
          id: true,
          slug: true,
          status: true,
          visibility: true,
          imageUrl: true,
          primaryAssetId: true,
          shopifyProductId: true,
          syncStatus: true,
        },
      }),
      prisma.productVariant.findMany({
        select: { id: true, productId: true, sku: true, imageUrl: true },
      }),
      prisma.productMedia.findMany({
        select: { id: true, productId: true, assetId: true },
      }),
      prisma.collection.findMany({
        select: {
          id: true,
          slug: true,
          status: true,
          visibility: true,
          heroAssetId: true,
          coverAssetId: true,
          heroImageUrl: true,
        },
      }),
      prisma.siteSetting.findUnique({
        where: { key: "site-videos" },
        select: { value: true },
      }),
      prisma.page.findMany({ select: { id: true, slug: true, content: true } }),
      prisma.pageTranslation.findMany({ select: { id: true, pageId: true, content: true } }),
      prisma.collectionSection.findMany({ select: { id: true, collectionId: true, content: true } }),
      prisma.productTranslation.findMany({
        select: { id: true, productId: true, details: true, localizedHandle: true },
      }),
    ]);

    const assetById = new Map(mediaAssets.map((a) => [a.id, a]));
    const assetByKey = new Map(mediaAssets.map((a) => [a.key, a]));
    const referencedAssetIds = new Set();
    for (const p of products) if (p.primaryAssetId) referencedAssetIds.add(p.primaryAssetId);
    for (const pm of productMedia) referencedAssetIds.add(pm.assetId);
    for (const c of collections) {
      if (c.heroAssetId) referencedAssetIds.add(c.heroAssetId);
      if (c.coverAssetId) referencedAssetIds.add(c.coverAssetId);
    }

    const siteVideos = siteVideosSetting?.value && typeof siteVideosSetting.value === "object"
      ? siteVideosSetting.value
      : {};
    const siteVideoKeys = new Map(); // slot -> key
    for (const slot of VIDEO_SLOTS) {
      const url = siteVideos[slot];
      if (typeof url !== "string" || !url) continue;
      const key = extractKeyFromUrl(url, s3Config);
      if (key) siteVideoKeys.set(slot, key);
      else siteVideoKeys.set(slot, `__unparsed__:${url.slice(0, 120)}`);
    }

    // ---------- Bucket listing (keys only) ----------
    const bucketObjects = await listAllBucketKeys(s3, bucketName);
    const bucketKeySet = new Set(bucketObjects.map((o) => o.key));
    const bucketByKey = new Map(bucketObjects.map((o) => [o.key, o]));

    notes.push({
      kind: "inventory",
      mediaAssetCount: mediaAssets.length,
      bucketObjectCount: bucketObjects.length,
      productCount: products.length,
      collectionCount: collections.length,
      productMediaCount: productMedia.length,
      variantCount: variants.length,
      siteVideoSlotsSet: [...siteVideoKeys.keys()],
    });

    // 1. Orphan MediaAsset (no primary / ProductMedia / hero / cover)
    {
      const orphans = mediaAssets.filter((a) => !referencedAssetIds.has(a.id));
      findings.push(
        finding(
          "M1",
          "MediaAsset without primary/ProductMedia/hero/cover reference",
          orphans.length ? "medium" : "info",
          orphans.length,
          orphans.map((a) => ({ id: a.id, key: a.key, status: a.status })),
          "Review before delete: may still be referenced from Page.content / CollectionSection.content / Product.details JSON or site-videos. Cross-check M9/JSON refs. Cleanup only after dry-run confirmation. Model: MediaAsset.",
        ),
      );
    }

    // 2. Bucket object with no MediaAsset.key and not site-videos
    {
      const siteVideoKeySet = new Set(
        [...siteVideoKeys.values()].filter((k) => !k.startsWith("__unparsed__")),
      );
      const stray = bucketObjects.filter(
        (o) => !assetByKey.has(o.key) && !siteVideoKeySet.has(o.key),
      );
      findings.push(
        finding(
          "M2",
          "Bucket object with no MediaAsset.key and not referenced by site-videos",
          stray.length ? "medium" : "info",
          stray.length,
          stray.map((o) => ({ key: o.key, size: o.size })),
          "Confirm no JSON/content references, then dry-run delete from bucket. Models: MediaAsset.key, SiteSetting key site-videos (lib/site-videos.ts).",
        ),
      );
    }

    // 3. MediaAsset.key missing from bucket
    {
      const missing = mediaAssets.filter((a) => !bucketKeySet.has(a.key));
      const head = await headSample(
        s3,
        bucketName,
        missing.map((a) => a.key),
      );
      findings.push(
        finding(
          "M3",
          "MediaAsset.key not present in bucket",
          missing.length ? "high" : "info",
          missing.length,
          missing.map((a) => ({ id: a.id, key: a.key, status: a.status })),
          "Broken media links. Re-upload or clear references (Product.primaryAssetId / ProductMedia / Collection hero|cover). Model: MediaAsset.key vs ListObjectsV2. HeadObject sampled for confirmation only.",
          { headSample: head },
        ),
      );
    }

    // 4. MediaAsset.bucket mismatch / null
    {
      const mismatch = mediaAssets.filter((a) => a.bucket !== bucketName);
      const nullBucket = mismatch.filter((a) => a.bucket == null);
      const otherBucket = mismatch.filter((a) => a.bucket != null);
      findings.push(
        finding(
          "M4",
          "MediaAsset.bucket does not match current S3_BUCKET (or is null)",
          mismatch.length ? "low" : "info",
          mismatch.length,
          mismatch.map((a) => ({
            id: a.id,
            key: a.key,
            bucket: a.bucket === null ? null : "[non-matching]",
            nullBucket: a.bucket == null,
          })),
          "Backfill MediaAsset.bucket to current S3_BUCKET from getS3Bucket() (lib/s3.ts). Null is historical; non-matching needs investigation. Counts: null=" +
            nullBucket.length +
            ", other=" +
            otherBucket.length +
            ".",
          { nullCount: nullBucket.length, otherCount: otherBucket.length },
        ),
      );
    }

    // 5. Product / variant imageUrl vs getS3PublicUrl(asset.key)
    {
      const productIssues = [];
      for (const p of products) {
        if (p.primaryAssetId) {
          const asset = assetById.get(p.primaryAssetId);
          if (!asset) {
            productIssues.push({
              kind: "product_primary_missing_asset",
              productId: p.id,
              slug: p.slug,
              primaryAssetId: p.primaryAssetId,
              imageUrl: p.imageUrl,
            });
            continue;
          }
          const expected = getS3PublicUrl(asset.key, s3Config);
          if (p.imageUrl !== expected) {
            productIssues.push({
              kind: "product_imageUrl_mismatch",
              productId: p.id,
              slug: p.slug,
              primaryAssetId: p.primaryAssetId,
              key: asset.key,
              imageUrl: p.imageUrl,
              expected,
            });
          }
        } else if (p.imageUrl) {
          productIssues.push({
            kind: "product_imageUrl_without_asset",
            productId: p.id,
            slug: p.slug,
            imageUrl: p.imageUrl,
          });
        }
      }

      const variantIssues = [];
      for (const v of variants) {
        if (!v.imageUrl) continue;
        // Variants have no asset FK — flag foreign/local leftovers and keys without MediaAsset
        const key = extractKeyFromUrl(v.imageUrl, s3Config);
        if (!key) {
          const cls = classifyForeignUrl(v.imageUrl, s3Config);
          if (cls) {
            variantIssues.push({
              kind: "variant_foreign_or_local_url",
              variantId: v.id,
              productId: v.productId,
              sku: v.sku,
              imageUrl: v.imageUrl,
              classification: cls,
            });
          }
          continue;
        }
        if (!assetByKey.has(key)) {
          variantIssues.push({
            kind: "variant_imageUrl_key_without_asset",
            variantId: v.id,
            productId: v.productId,
            sku: v.sku,
            key,
            imageUrl: v.imageUrl,
          });
        } else {
          const expected = getS3PublicUrl(key, s3Config);
          if (v.imageUrl !== expected) {
            variantIssues.push({
              kind: "variant_imageUrl_mismatch",
              variantId: v.id,
              productId: v.productId,
              sku: v.sku,
              key,
              imageUrl: v.imageUrl,
              expected,
            });
          }
        }
      }

      findings.push(
        finding(
          "M5a",
          "Product.imageUrl / primaryAssetId inconsistency vs getS3PublicUrl(asset.key)",
          productIssues.length ? "high" : "info",
          productIssues.length,
          productIssues,
          "Realign Product.imageUrl with getS3PublicUrl(MediaAsset.key) (lib/s3.ts) or clear dangling primaryAssetId. Models: Product.imageUrl, Product.primaryAssetId.",
        ),
      );
      findings.push(
        finding(
          "M5b",
          "ProductVariant.imageUrl inconsistency (mismatch / missing MediaAsset / foreign URL)",
          variantIssues.length ? "medium" : "info",
          variantIssues.length,
          variantIssues,
          "Normalize variant imageUrl to getS3PublicUrl(key) or clear. Model: ProductVariant.imageUrl (no asset FK).",
        ),
      );

      // Collection.heroImageUrl vs hero asset
      const collectionUrlIssues = [];
      for (const c of collections) {
        if (c.heroAssetId) {
          const asset = assetById.get(c.heroAssetId);
          if (!asset) {
            collectionUrlIssues.push({
              kind: "collection_hero_missing_asset",
              collectionId: c.id,
              slug: c.slug,
              heroAssetId: c.heroAssetId,
            });
          } else if (c.heroImageUrl) {
            const expected = getS3PublicUrl(asset.key, s3Config);
            if (c.heroImageUrl !== expected) {
              collectionUrlIssues.push({
                kind: "collection_heroImageUrl_mismatch",
                collectionId: c.id,
                slug: c.slug,
                key: asset.key,
                heroImageUrl: c.heroImageUrl,
                expected,
              });
            }
          }
        } else if (c.heroImageUrl) {
          collectionUrlIssues.push({
            kind: "collection_heroImageUrl_without_asset",
            collectionId: c.id,
            slug: c.slug,
            heroImageUrl: c.heroImageUrl,
          });
        }
      }
      findings.push(
        finding(
          "M5c",
          "Collection.heroImageUrl / heroAssetId inconsistency",
          collectionUrlIssues.length ? "medium" : "info",
          collectionUrlIssues.length,
          collectionUrlIssues,
          "Align Collection.heroImageUrl with hero MediaAsset or clear. Models: Collection.heroImageUrl, Collection.heroAssetId.",
        ),
      );
    }

    // 6. site-videos keys missing in bucket; uploads/videos/** not in any slot
    {
      const missingSlots = [];
      for (const [slot, key] of siteVideoKeys) {
        if (key.startsWith("__unparsed__")) {
          missingSlots.push({ slot, issue: "unparsed_url", value: key.slice("__unparsed__:".length) });
          continue;
        }
        if (!bucketKeySet.has(key)) {
          missingSlots.push({ slot, issue: "missing_in_bucket", key });
        }
      }
      const slotKeySet = new Set(
        [...siteVideoKeys.values()].filter((k) => !k.startsWith("__unparsed__")),
      );
      const videoObjects = bucketObjects.filter((o) => o.key.startsWith("uploads/videos/"));
      const unslot = videoObjects.filter((o) => !slotKeySet.has(o.key));
      findings.push(
        finding(
          "M6a",
          "site-videos slot key missing in bucket or unparsed URL",
          missingSlots.length ? "high" : "info",
          missingSlots.length,
          missingSlots,
          "Re-upload video for slot or clear SiteSetting site-videos value. lib/site-videos.ts slots: homeBeads, homeModel, braceletFilm, materialsFilm.",
        ),
      );
      findings.push(
        finding(
          "M6b",
          "Bucket uploads/videos/** object not referenced by any site-videos slot",
          unslot.length ? "low" : "info",
          unslot.length,
          unslot.map((o) => ({ key: o.key, size: o.size })),
          "Likely superseded uploads. Dry-run delete after confirming no other JSON references. Prefix: uploads/videos/<slot>/.",
        ),
      );
    }

    // 7. Duplicate candidates by filename+sizeBytes and same sizeBytes in folder
    {
      const byNameSize = new Map();
      for (const a of mediaAssets) {
        const k = `${a.filename}::${a.sizeBytes ?? "null"}`;
        if (!byNameSize.has(k)) byNameSize.set(k, []);
        byNameSize.get(k).push(a);
      }
      const nameSizeDupes = [...byNameSize.entries()]
        .filter(([, rows]) => rows.length > 1)
        .map(([k, rows]) => ({
          filename_size: k,
          count: rows.length,
          ids: rows.map((r) => r.id),
          keys: rows.map((r) => r.key),
        }));

      const byFolderSize = new Map();
      for (const a of mediaAssets) {
        const folder = a.key.startsWith("uploads/products/")
          ? "uploads/products"
          : a.key.startsWith("uploads/collections/")
            ? "uploads/collections"
            : a.key.startsWith("uploads/videos/")
              ? "uploads/videos"
              : null;
        if (!folder || a.sizeBytes == null) continue;
        const k = `${folder}::${a.sizeBytes}`;
        if (!byFolderSize.has(k)) byFolderSize.set(k, []);
        byFolderSize.get(k).push(a);
      }
      const folderSizeDupes = [...byFolderSize.entries()]
        .filter(([, rows]) => rows.length > 1)
        .map(([k, rows]) => ({
          folder_size: k,
          count: rows.length,
          ids: rows.map((r) => r.id),
          keys: rows.map((r) => r.key),
        }));

      findings.push(
        finding(
          "M7a",
          "Possible duplicate MediaAsset by filename+sizeBytes (key remains unique)",
          nameSizeDupes.length ? "low" : "info",
          nameSizeDupes.length,
          nameSizeDupes,
          "Manual review — MediaAsset.key is @unique so true key dupes are impossible. Candidates may be re-uploads. Model: MediaAsset.",
        ),
      );
      findings.push(
        finding(
          "M7b",
          "Possible duplicate MediaAsset by identical sizeBytes within uploads/products|collections|videos",
          folderSizeDupes.length ? "info" : "info",
          folderSizeDupes.length,
          folderSizeDupes,
          "Heuristic only (same byte size ≠ same file). Compare ETags via HeadObject on sample if cleaning. Model: MediaAsset.sizeBytes.",
        ),
      );
    }

    // 8. status != READY but still attached to published product/collection
    {
      const publishedProductIds = new Set(
        products
          .filter((p) => p.status === "ACTIVE" && p.visibility === "PUBLIC")
          .map((p) => p.id),
      );
      const publishedCollectionIds = new Set(
        collections
          .filter((c) => c.status === "ACTIVE" && c.visibility === "PUBLIC")
          .map((c) => c.id),
      );
      const attached = [];
      for (const a of mediaAssets) {
        if (a.status === "READY") continue;
        const asPrimary = products.filter(
          (p) => p.primaryAssetId === a.id && publishedProductIds.has(p.id),
        );
        const asGallery = productMedia.filter(
          (pm) => pm.assetId === a.id && publishedProductIds.has(pm.productId),
        );
        const asHero = collections.filter(
          (c) => c.heroAssetId === a.id && publishedCollectionIds.has(c.id),
        );
        const asCover = collections.filter(
          (c) => c.coverAssetId === a.id && publishedCollectionIds.has(c.id),
        );
        if (asPrimary.length || asGallery.length || asHero.length || asCover.length) {
          attached.push({
            id: a.id,
            key: a.key,
            status: a.status,
            primaryProductIds: asPrimary.map((p) => p.id),
            galleryProductIds: asGallery.map((pm) => pm.productId),
            heroCollectionIds: asHero.map((c) => c.id),
            coverCollectionIds: asCover.map((c) => c.id),
          });
        }
      }
      findings.push(
        finding(
          "M8",
          "MediaAsset status != READY but attached to published Product/Collection",
          attached.length ? "high" : "info",
          attached.length,
          attached,
          "Mark READY after verifying object exists, or detach from published entities. Models: MediaAsset.status, Product.status/visibility, Collection.status/visibility.",
        ),
      );
    }

    // 9. Local /uploads/ and foreign hosts in imageUrl + JSON content
    {
      const leftovers = [];
      const checkUrl = (ctx, url) => {
        const cls = classifyForeignUrl(url, s3Config);
        if (cls) leftovers.push({ ...ctx, url, classification: cls });
      };
      for (const p of products) if (p.imageUrl) checkUrl({ source: "Product.imageUrl", id: p.id }, p.imageUrl);
      for (const v of variants) if (v.imageUrl) checkUrl({ source: "ProductVariant.imageUrl", id: v.id }, v.imageUrl);
      for (const c of collections) {
        if (c.heroImageUrl) checkUrl({ source: "Collection.heroImageUrl", id: c.id }, c.heroImageUrl);
      }
      for (const page of pages) {
        walkStrings(page.content, (s) => {
          if (s.includes("/uploads/") || s.includes("/media/uploads/") || /^https?:\/\//i.test(s)) {
            checkUrl({ source: "Page.content", id: page.id }, s);
          }
        });
      }
      for (const pt of pageTranslations) {
        walkStrings(pt.content, (s) => {
          if (s.includes("/uploads/") || s.includes("/media/uploads/") || /^https?:\/\//i.test(s)) {
            checkUrl({ source: "PageTranslation.content", id: pt.id, pageId: pt.pageId }, s);
          }
        });
      }
      for (const sec of collectionSections) {
        walkStrings(sec.content, (s) => {
          if (s.includes("/uploads/") || s.includes("/media/uploads/") || /^https?:\/\//i.test(s)) {
            checkUrl({ source: "CollectionSection.content", id: sec.id }, s);
          }
        });
      }
      for (const tr of productTranslations) {
        walkStrings(tr.details, (s) => {
          if (s.includes("/uploads/") || s.includes("/media/uploads/") || /^https?:\/\//i.test(s)) {
            checkUrl({ source: "ProductTranslation.details", id: tr.id }, s);
          }
        });
      }
      // Only keep problematic classifications (not valid /media/ or current bucket URLs)
      const bad = leftovers.filter((x) => x.classification);
      findings.push(
        finding(
          "M9",
          "Local /uploads/ paths or foreign hosts in imageUrl / JSON content",
          bad.length ? "medium" : "info",
          bad.length,
          bad,
          "Rewrite to /media/<key> via getS3PublicUrl or clear. Models: Product.imageUrl, ProductVariant.imageUrl, Collection.heroImageUrl, Page.content, PageTranslation.content, CollectionSection.content, ProductTranslation.details.",
        ),
      );
    }

    // 10. Keys outside expected prefixes
    {
      const badAssets = mediaAssets.filter(
        (a) => !EXPECTED_PREFIXES.some((p) => a.key.startsWith(p)),
      );
      const badObjects = bucketObjects.filter(
        (o) => !EXPECTED_PREFIXES.some((p) => o.key.startsWith(p)),
      );
      findings.push(
        finding(
          "M10a",
          "MediaAsset.key outside uploads/products|collections|videos",
          badAssets.length ? "low" : "info",
          badAssets.length,
          badAssets.map((a) => ({ id: a.id, key: a.key })),
          "Confirm intentional legacy keys; otherwise migrate under expected prefixes. Model: MediaAsset.key.",
        ),
      );
      findings.push(
        finding(
          "M10b",
          "Bucket keys outside uploads/products|collections|videos",
          badObjects.length ? "low" : "info",
          badObjects.length,
          badObjects.map((o) => ({ key: o.key, size: o.size })),
          "Inventory non-media keys (e.g. tooling). Do not delete without confirmation.",
        ),
      );
    }

    // JSON references to media keys that have no MediaAsset (informational complement to M1)
    {
      const jsonKeys = new Set();
      const collect = (s) => {
        const key = extractKeyFromUrl(s, s3Config);
        if (key && (key.startsWith("uploads/") || s.includes("/media/uploads/"))) jsonKeys.add(key);
        // also raw path fragments
        const m = s.match(/(?:\/media\/)?(uploads\/(?:products|collections|videos)\/[^\s"'\\]+)/);
        if (m) jsonKeys.add(decodeURIComponent(m[1]));
      };
      for (const page of pages) walkStrings(page.content, collect);
      for (const pt of pageTranslations) walkStrings(pt.content, collect);
      for (const sec of collectionSections) walkStrings(sec.content, collect);
      for (const tr of productTranslations) walkStrings(tr.details, collect);
      for (const [, key] of siteVideoKeys) {
        if (!key.startsWith("__unparsed__")) jsonKeys.add(key);
      }
      const orphanButJson = mediaAssets.filter(
        (a) => !referencedAssetIds.has(a.id) && jsonKeys.has(a.key),
      );
      // site-videos keys intentionally have no MediaAsset — exclude them
      const siteKeys = new Set(
        [...siteVideoKeys.values()].filter((k) => !k.startsWith("__unparsed__")),
      );
      const jsonMissingAsset = [...jsonKeys].filter((k) => !assetByKey.has(k) && !siteKeys.has(k));
      findings.push(
        finding(
          "M1b",
          "Orphan MediaAsset (no FK refs) but key appears in JSON/site content",
          orphanButJson.length ? "info" : "info",
          orphanButJson.length,
          orphanButJson.map((a) => ({ id: a.id, key: a.key })),
          "Do not treat as deletable orphans — still referenced from JSON. Models: Page.content / sections / details.",
        ),
      );
      findings.push(
        finding(
          "M2b",
          "JSON content references uploads/ key with neither MediaAsset nor site-videos slot",
          jsonMissingAsset.length ? "medium" : "info",
          jsonMissingAsset.length,
          jsonMissingAsset.map((key) => ({ key, inBucket: bucketKeySet.has(key) })),
          "Create MediaAsset or rewrite/remove JSON reference. HeadObject only if investigating specific keys.",
        ),
      );
    }

    // ---------- Data integrity ----------
    const [
      orphanProductMedia,
      orphanProductTag,
      orphanProductCollection,
      orphanPvov,
      orphanProductTranslation,
      orphanCollectionTranslation,
      orphanPageTranslation,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT pm.id FROM "ProductMedia" pm
        LEFT JOIN "Product" p ON p.id = pm."productId"
        LEFT JOIN "MediaAsset" a ON a.id = pm."assetId"
        WHERE p.id IS NULL OR a.id IS NULL
        LIMIT 50`,
      prisma.$queryRaw`
        SELECT pt.id FROM "ProductTag" pt
        LEFT JOIN "Product" p ON p.id = pt."productId"
        LEFT JOIN "Tag" t ON t.id = pt."tagId"
        WHERE p.id IS NULL OR t.id IS NULL
        LIMIT 50`,
      prisma.$queryRaw`
        SELECT pc.id FROM "ProductCollection" pc
        LEFT JOIN "Product" p ON p.id = pc."productId"
        LEFT JOIN "Collection" c ON c.id = pc."collectionId"
        WHERE p.id IS NULL OR c.id IS NULL
        LIMIT 50`,
      prisma.$queryRaw`
        SELECT x.id FROM "ProductVariantOptionValue" x
        LEFT JOIN "ProductVariant" v ON v.id = x."variantId"
        LEFT JOIN "ProductOptionValue" ov ON ov.id = x."optionValueId"
        WHERE v.id IS NULL OR ov.id IS NULL
        LIMIT 50`,
      prisma.$queryRaw`
        SELECT id FROM "ProductTranslation" WHERE "productId" NOT IN (SELECT id FROM "Product") LIMIT 50`,
      prisma.$queryRaw`
        SELECT id FROM "CollectionTranslation" WHERE "collectionId" NOT IN (SELECT id FROM "Collection") LIMIT 50`,
      prisma.$queryRaw`
        SELECT id FROM "PageTranslation" WHERE "pageId" NOT IN (SELECT id FROM "Page") LIMIT 50`,
    ]);

    {
      const breakdown = {
        ProductMedia: orphanProductMedia.length,
        ProductTag: orphanProductTag.length,
        ProductCollection: orphanProductCollection.length,
        ProductVariantOptionValue: orphanPvov.length,
        ProductTranslation: orphanProductTranslation.length,
        CollectionTranslation: orphanCollectionTranslation.length,
        PageTranslation: orphanPageTranslation.length,
      };
      const d1Total = Object.values(breakdown).reduce((a, b) => a + b, 0);
      const d1Samples = take([
        ...orphanProductMedia.map((r) => ({ table: "ProductMedia", ...r })),
        ...orphanProductTag.map((r) => ({ table: "ProductTag", ...r })),
        ...orphanProductCollection.map((r) => ({ table: "ProductCollection", ...r })),
        ...orphanPvov.map((r) => ({ table: "ProductVariantOptionValue", ...r })),
        ...orphanProductTranslation.map((r) => ({ table: "ProductTranslation", ...r })),
        ...orphanCollectionTranslation.map((r) => ({ table: "CollectionTranslation", ...r })),
        ...orphanPageTranslation.map((r) => ({ table: "PageTranslation", ...r })),
      ]);
      findings.push(
        finding(
          "D1",
          "Orphan join/translation rows (FK parent missing)",
          d1Total ? "high" : "info",
          d1Total,
          d1Samples,
          "Unexpected under Prisma onDelete Cascade — investigate DB integrity / manual SQL. Models listed in counts.",
          { breakdown },
        ),
      );
    }

    // Shopify sync drift vs last ProductSyncEvent without open AdminIssue
    {
      const linked = products.filter((p) => p.shopifyProductId);
      const drift = [];
      for (const p of linked) {
        if (p.syncStatus !== "FAILED" && p.syncStatus !== "CONFLICT") continue;
        const lastEvent = await prisma.productSyncEvent.findFirst({
          where: { productId: p.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, createdAt: true, error: true },
        });
        if (!lastEvent) continue;
        if (lastEvent.status !== "FAILED" && lastEvent.status !== "CONFLICT") continue;
        const openIssue = await prisma.adminIssue.findFirst({
          where: { status: "OPEN", entityType: "PRODUCT", entityId: p.id },
          select: { id: true },
        });
        if (!openIssue) {
          drift.push({
            productId: p.id,
            slug: p.slug,
            syncStatus: p.syncStatus,
            lastEventId: lastEvent.id,
            lastEventStatus: lastEvent.status,
            lastEventAt: lastEvent.createdAt,
          });
        }
      }
      findings.push(
        finding(
          "D2",
          "Product with shopifyProductId in FAILED/CONFLICT without OPEN AdminIssue (aligned with latest ProductSyncEvent)",
          drift.length ? "medium" : "info",
          drift.length,
          drift,
          "Open or refresh AdminIssue via scanAdminIssues (lib/admin/issues.ts). Models: Product.syncStatus, ProductSyncEvent, AdminIssue.",
        ),
      );
    }

    // Empty / broken localized handles + redirects
    {
      const emptyHandles = await prisma.$queryRaw`
        SELECT 'ProductTranslation' AS "table", id, "productId" AS "entityId", locale, "localizedHandle"
        FROM "ProductTranslation"
        WHERE "localizedHandle" IS NOT NULL AND btrim("localizedHandle") = ''
        UNION ALL
        SELECT 'CollectionTranslation', id, "collectionId", locale, "localizedHandle"
        FROM "CollectionTranslation"
        WHERE "localizedHandle" IS NOT NULL AND btrim("localizedHandle") = ''
        UNION ALL
        SELECT 'PageTranslation', id, "pageId", locale, "localizedHandle"
        FROM "PageTranslation"
        WHERE "localizedHandle" IS NOT NULL AND btrim("localizedHandle") = ''
        LIMIT 50`;
      findings.push(
        finding(
          "D3a",
          "Empty localizedHandle strings (non-null but blank)",
          emptyHandles.length ? "low" : "info",
          emptyHandles.length,
          emptyHandles,
          "Set localizedHandle to NULL or a valid slug. Models: *Translation.localizedHandle.",
        ),
      );

      const redirects = await prisma.localizedHandleRedirect.findMany({
        select: { id: true, entityType: true, entityId: true, locale: true, fromHandle: true, toHandle: true },
      });
      const productIds = new Set(products.map((p) => p.id));
      const collectionIds = new Set(collections.map((c) => c.id));
      const pageIds = new Set(pages.map((p) => p.id));
      const brokenRedirects = redirects.filter((r) => {
        const t = r.entityType.toUpperCase();
        if (t === "PRODUCT") return !productIds.has(r.entityId);
        if (t === "COLLECTION") return !collectionIds.has(r.entityId);
        if (t === "PAGE") return !pageIds.has(r.entityId);
        return true;
      });
      findings.push(
        finding(
          "D3b",
          "LocalizedHandleRedirect.entityId does not exist",
          brokenRedirects.length ? "medium" : "info",
          brokenRedirects.length,
          brokenRedirects,
          "Delete stale redirects after dry-run. Model: LocalizedHandleRedirect.",
        ),
      );
    }

    // SiteSetting keys code does not read
    {
      const settings = await prisma.siteSetting.findMany({ select: { id: true, key: true, updatedAt: true } });
      const unread = settings.filter((s) => !KNOWN_SITE_SETTING_KEYS.has(s.key));
      findings.push(
        finding(
          "D4",
          "SiteSetting keys not read by application code",
          unread.length ? "low" : "info",
          unread.length,
          unread.map((s) => ({ id: s.id, key: s.key, updatedAt: s.updatedAt })),
          "Known readers: site-videos, site-seo-v1, storefront-copy-v1, shopify.store_binding. Archive/delete unread keys only after confirming no external/admin consumers. Model: SiteSetting.",
          { knownKeys: [...KNOWN_SITE_SETTING_KEYS], allKeys: settings.map((s) => s.key) },
        ),
      );
    }

    // OPEN AdminIssue whose entity is gone
    {
      const openIssues = await prisma.adminIssue.findMany({
        where: { status: "OPEN" },
        select: { id: true, entityType: true, entityId: true, key: true, title: true },
      });
      const productIds = new Set(products.map((p) => p.id));
      const collectionIds = new Set(collections.map((c) => c.id));
      const stale = [];
      for (const issue of openIssues) {
        const t = issue.entityType.toUpperCase();
        let exists = true;
        if (t === "PRODUCT") exists = productIds.has(issue.entityId);
        else if (t === "COLLECTION") exists = collectionIds.has(issue.entityId);
        else {
          // unknown type — leave note
          stale.push({ ...issue, note: "unknown_entityType_not_validated" });
          continue;
        }
        if (!exists) stale.push(issue);
      }
      const gone = stale.filter((s) => !s.note);
      findings.push(
        finding(
          "D5",
          "OPEN AdminIssue whose entityId no longer exists",
          gone.length ? "medium" : "info",
          gone.length,
          gone,
          "Resolve/close orphan issues. Model: AdminIssue. Total OPEN issues: " + openIssues.length + ".",
          { openIssueCount: openIssues.length, unknownTypeSamples: take(stale.filter((s) => s.note)) },
        ),
      );
    }

    // Expired sessions / rate limits — volume only
    {
      const now = new Date();
      const [expiredAdmin, expiredCustomerAccess, expiredCustomerSession, expiredRate] =
        await Promise.all([
          prisma.adminSession.count({ where: { expiresAt: { lt: now } } }),
          prisma.shopifyCustomerSession.count({ where: { accessTokenExpiresAt: { lt: now } } }),
          prisma.shopifyCustomerSession.count({ where: { sessionExpiresAt: { lt: now } } }),
          prisma.rateLimitBucket.count({ where: { resetAt: { lt: now } } }),
        ]);
      const [adminTotal, customerTotal, rateTotal] = await Promise.all([
        prisma.adminSession.count(),
        prisma.shopifyCustomerSession.count(),
        prisma.rateLimitBucket.count(),
      ]);
      findings.push(
        finding(
          "D6",
          "Expired AdminSession / ShopifyCustomerSession / RateLimitBucket volume",
          "info",
          expiredAdmin + expiredCustomerAccess + expiredCustomerSession + expiredRate,
          [
            { model: "AdminSession", expired: expiredAdmin, total: adminTotal },
            {
              model: "ShopifyCustomerSession.accessTokenExpiresAt",
              expired: expiredCustomerAccess,
              total: customerTotal,
            },
            {
              model: "ShopifyCustomerSession.sessionExpiresAt",
              expired: expiredCustomerSession,
              total: customerTotal,
            },
            { model: "RateLimitBucket", expired: expiredRate, total: rateTotal },
          ],
          "Volume observation only — purge only after explicit confirmation + dry-run. Models: AdminSession.expiresAt, ShopifyCustomerSession.*, RateLimitBucket.resetAt.",
        ),
      );
    }

    // Growth tables share of DB
    {
      const tableSizes = await prisma.$queryRaw`
        SELECT c.relname AS name,
               pg_total_relation_size(c.oid) AS total_bytes,
               s.n_live_tup::bigint AS live_tuples
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC`;
      const dbSize = await prisma.$queryRaw`SELECT pg_database_size(current_database())::bigint AS bytes`;
      const totalDb = Number(dbSize[0].bytes);
      const growthNames = new Set([
        "AuditLog",
        "TranslationSyncEvent",
        "ShopifyTranslationSnapshot",
        "ShopifyReconcileRun",
        "ProductIncomingUpdate",
        "ProductIncomingUpdateView",
        "ProductSyncEvent",
        "ShopifyFieldDivergence",
      ]);
      const growth = tableSizes
        .filter((t) => growthNames.has(t.name))
        .map((t) => ({
          table: t.name,
          bytes: Number(t.total_bytes),
          liveTuples: Number(t.live_tuples ?? 0),
          pctOfDb: totalDb ? Number(((Number(t.total_bytes) / totalDb) * 100).toFixed(2)) : null,
        }));
      findings.push(
        finding(
          "D7",
          "Growth / event tables — size share of database",
          "info",
          growth.length,
          growth,
          "Consider retention only if pctOfDb or liveTuples is material. Models listed. No deletion in this audit.",
          {
            databaseBytes: totalDb,
            topTables: take(
              tableSizes.map((t) => ({
                table: t.name,
                bytes: Number(t.total_bytes),
                liveTuples: Number(t.live_tuples ?? 0),
                pctOfDb: totalDb ? Number(((Number(t.total_bytes) / totalDb) * 100).toFixed(2)) : null,
              })),
              15,
            ),
          },
        ),
      );

      // Postgres optimization observations
      const vacuumCandidates = await prisma.$queryRaw`
        SELECT s.relname AS name,
               s.n_live_tup::bigint AS live,
               s.n_dead_tup::bigint AS dead,
               CASE WHEN s.n_live_tup > 0 THEN round((s.n_dead_tup::numeric / s.n_live_tup::numeric) * 100, 2) ELSE NULL END AS dead_pct,
               s.last_vacuum, s.last_autovacuum, s.last_analyze, s.last_autoanalyze,
               s.seq_scan::bigint, s.idx_scan::bigint
        FROM pg_stat_user_tables s
        ORDER BY s.n_dead_tup DESC NULLS LAST
        LIMIT 30`;

      const unusedIndexes = await prisma.$queryRaw`
        SELECT s.relname AS table_name,
               s.indexrelname AS index_name,
               pg_relation_size(s.indexrelid) AS index_bytes,
               s.idx_scan::bigint AS scans
        FROM pg_stat_user_indexes s
        WHERE s.idx_scan = 0
          AND pg_relation_size(s.indexrelid) > 8192
          AND NOT EXISTS (
            SELECT 1
            FROM pg_index i
            WHERE i.indexrelid = s.indexrelid
              AND (i.indisunique OR i.indisprimary)
          )
        ORDER BY pg_relation_size(s.indexrelid) DESC
        LIMIT 30`;

      const seqHeavy = await prisma.$queryRaw`
        SELECT s.relname AS name,
               s.seq_scan::bigint AS seq_scan,
               s.idx_scan::bigint AS idx_scan,
               s.n_live_tup::bigint AS live
        FROM pg_stat_user_tables s
        WHERE s.n_live_tup > 1000
          AND s.seq_scan > s.idx_scan
        ORDER BY s.seq_scan DESC
        LIMIT 20`;

      const cacheHit = await prisma.$queryRaw`
        SELECT
          sum(blks_hit)::bigint AS hits,
          sum(blks_read)::bigint AS reads,
          CASE WHEN sum(blks_hit)+sum(blks_read) > 0
            THEN round(sum(blks_hit)::numeric / (sum(blks_hit)+sum(blks_read)) * 100, 2)
            ELSE NULL END AS hit_pct
        FROM pg_stat_database
        WHERE datname = current_database()`;

      const connections = await prisma.$queryRaw`
        SELECT state, count(*)::int AS count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state
        ORDER BY count DESC`;

      const maxConn = await prisma.$queryRaw`SHOW max_connections`;

      let pgStatStatements = null;
      try {
        const ext = await prisma.$queryRaw`
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`;
        if (ext.length) {
          pgStatStatements = await prisma.$queryRaw`
            SELECT queryid::text,
                   left(query, 160) AS query_preview,
                   calls::bigint,
                   round(total_exec_time::numeric, 2) AS total_exec_time_ms,
                   round(mean_exec_time::numeric, 2) AS mean_exec_time_ms
            FROM pg_stat_statements
            ORDER BY total_exec_time DESC
            LIMIT 15`;
        } else {
          pgStatStatements = { available: false, reason: "extension pg_stat_statements not installed" };
        }
      } catch (error) {
        pgStatStatements = {
          available: false,
          reason: error?.message?.slice(0, 200) ?? "query failed",
        };
      }

      // Migration drift
      const diskMigrations = (
        await import("node:fs/promises").then((fs) => fs.readdir(path.join(__dirname, "../../prisma/migrations")))
      ).filter((name) => /^\d+_/.test(name));
      const applied = await prisma.$queryRaw`
        SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
        FROM "_prisma_migrations"
        ORDER BY finished_at ASC NULLS LAST`;
      const appliedNames = new Set(applied.map((m) => m.migration_name));
      const diskSet = new Set(diskMigrations);
      const missingInDb = diskMigrations.filter((m) => !appliedNames.has(m));
      const extraInDb = [...appliedNames].filter((m) => !diskSet.has(m));
      const failed = applied.filter((m) => m.rolled_back_at != null || m.finished_at == null);

      findings.push(
        finding(
          "P1",
          "Postgres size / dead tuples / seq vs idx / unused indexes / cache / connections",
          "info",
          Number(vacuumCandidates[0]?.dead ?? 0),
          [],
          "Observation only. Consider VACUUM/ANALYZE on high dead_pct tables if autovacuum lags. Review unused indexes only after confirming no rare admin queries. Do not DROP INDEX without confirmation.",
          {
            databaseBytes: totalDb,
            topTablesBySize: take(
              tableSizes.map((t) => ({
                table: t.name,
                bytes: Number(t.total_bytes),
                liveTuples: Number(t.live_tuples ?? 0),
              })),
              15,
            ),
            vacuumCandidates: take(
              vacuumCandidates.map((r) => ({
                table: r.name,
                live: Number(r.live ?? 0),
                dead: Number(r.dead ?? 0),
                deadPct: r.dead_pct != null ? Number(r.dead_pct) : null,
                lastVacuum: r.last_vacuum,
                lastAutovacuum: r.last_autovacuum,
                seqScan: Number(r.seq_scan ?? 0),
                idxScan: Number(r.idx_scan ?? 0),
              })),
              15,
            ),
            seqHeavyTables: take(
              seqHeavy.map((r) => ({
                table: r.name,
                live: Number(r.live ?? 0),
                seqScan: Number(r.seq_scan ?? 0),
                idxScan: Number(r.idx_scan ?? 0),
              })),
            ),
            unusedIndexes: take(
              unusedIndexes.map((r) => ({
                table: r.table_name,
                index: r.index_name,
                bytes: Number(r.index_bytes),
                scans: Number(r.scans),
              })),
            ),
            cacheHit: {
              hits: Number(cacheHit[0]?.hits ?? 0),
              reads: Number(cacheHit[0]?.reads ?? 0),
              hitPct: cacheHit[0]?.hit_pct != null ? Number(cacheHit[0].hit_pct) : null,
            },
            connections: connections.map((c) => ({
              state: c.state,
              count: Number(c.count),
            })),
            maxConnections: maxConn[0]?.max_connections ?? null,
            pgStatStatements,
          },
        ),
      );

      const p2Samples = take([
        ...missingInDb.map((m) => ({ kind: "missingInDb", name: m })),
        ...extraInDb.map((m) => ({ kind: "extraInDb", name: m })),
        ...failed.map((m) => ({
          kind: "failed",
          migration_name: m.migration_name,
          finished_at: m.finished_at,
          rolled_back_at: m.rolled_back_at,
        })),
      ]);
      findings.push(
        finding(
          "P2",
          "Prisma migration drift (_prisma_migrations vs prisma/migrations)",
          missingInDb.length || extraInDb.length || failed.length ? "high" : "info",
          missingInDb.length + extraInDb.length + failed.length,
          p2Samples,
          "Do not apply migrations in this audit. Investigate drift with prisma migrate status. Table: _prisma_migrations; folder: prisma/migrations.",
          {
            diskCount: diskMigrations.length,
            appliedCount: applied.length,
            missingInDbCount: missingInDb.length,
            extraInDbCount: extraInDb.length,
            failedCount: failed.length,
          },
        ),
      );
    }

    const result = {
      meta: {
        startedAt,
        finishedAt: new Date().toISOString(),
        readOnly: true,
        s3: s3Meta,
        sampleLimit: SAMPLE_LIMIT,
        expectedPrefixes: EXPECTED_PREFIXES,
        knownSiteSettingKeys: [...KNOWN_SITE_SETTING_KEYS],
      },
      notes,
      findings,
    };

    // BigInt-safe JSON
    const json = JSON.stringify(
      result,
      (_k, v) => (typeof v === "bigint" ? Number(v) : v),
      2,
    );
    await writeFile(OUT_JSON, json, "utf8");
    console.log(`Wrote ${OUT_JSON}`);
    console.log(
      `Findings: ${findings.length}; non-info: ${findings.filter((f) => f.severity !== "info").length}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
