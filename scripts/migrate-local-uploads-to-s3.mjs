import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const uploadsDir = path.join(rootDir, "public", "uploads");
const prisma = new PrismaClient();

const mimeByExtension = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function publicUrlForKey(key) {
  const normalizedKey = key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  if (process.env.S3_PUBLIC_URL) {
    return `${trimTrailingSlash(process.env.S3_PUBLIC_URL)}/${normalizedKey}`;
  }

  const bucket = requiredEnv("S3_BUCKET");

  if (process.env.S3_ENDPOINT) {
    return `${trimTrailingSlash(process.env.S3_ENDPOINT)}/${bucket}/${normalizedKey}`;
  }

  return `https://${bucket}.s3.${requiredEnv("S3_REGION")}.amazonaws.com/${normalizedKey}`;
}

function replaceUploadUrls(value, mapping) {
  if (typeof value === "string") {
    return mapping.get(value) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceUploadUrls(item, mapping));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceUploadUrls(item, mapping)]),
    );
  }

  return value;
}

async function listUploadFiles(dir = uploadsDir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listUploadFiles(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function updateJsonRecords(model, field, mapping) {
  const records = await prisma[model].findMany({ select: { id: true, [field]: true } });
  let updated = 0;

  for (const record of records) {
    const nextValue = replaceUploadUrls(record[field], mapping);
    if (JSON.stringify(nextValue) === JSON.stringify(record[field])) continue;

    await prisma[model].update({
      where: { id: record.id },
      data: { [field]: nextValue },
    });
    updated += 1;
  }

  return updated;
}

async function main() {
  const bucket = requiredEnv("S3_BUCKET");
  const s3 = new S3Client({
    region: requiredEnv("S3_REGION"),
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  });

  const files = await listUploadFiles();
  const mapping = new Map();

  for (const filePath of files) {
    const key = path.relative(path.join(rootDir, "public"), filePath).split(path.sep).join("/");
    const publicUrl = publicUrlForKey(key);
    const extension = path.extname(filePath).toLowerCase();

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: await readFile(filePath),
        ContentType: mimeByExtension.get(extension) ?? "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    mapping.set(`/${key}`, publicUrl);
    await prisma.mediaAsset.updateMany({
      where: { key },
      data: { bucket, updatedAt: new Date() },
    });
  }

  const productImages = await Promise.all(
    [...mapping].map(([localUrl, publicUrl]) =>
      prisma.product.updateMany({ where: { imageUrl: localUrl }, data: { imageUrl: publicUrl } }),
    ),
  );
  const collectionHeroes = await Promise.all(
    [...mapping].map(([localUrl, publicUrl]) =>
      prisma.collection.updateMany({ where: { heroImageUrl: localUrl }, data: { heroImageUrl: publicUrl } }),
    ),
  );
  const jsonUpdates = await Promise.all([
    updateJsonRecords("product", "details", mapping),
    updateJsonRecords("collectionSection", "content", mapping),
    updateJsonRecords("page", "content", mapping),
    updateJsonRecords("siteSetting", "value", mapping),
  ]);

  console.log(`Uploaded ${files.length} file(s) to S3.`);
  console.log(`Replaced ${mapping.size} local upload URL(s).`);
  console.log(
    `Updated rows: products=${productImages.reduce((sum, item) => sum + item.count, 0)}, ` +
      `collections=${collectionHeroes.reduce((sum, item) => sum + item.count, 0)}, ` +
      `json=${jsonUpdates.reduce((sum, count) => sum + count, 0)}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
