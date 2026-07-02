import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const UPLOADS_ROOT_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_IMAGE_DIMENSION = 3200;
const LARGE_IMAGE_BYTES = 4 * 1024 * 1024;
const WEBP_QUALITY = 94;

function sanitizeBaseName(filename: string) {
  return filename
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "product-image";
}

function extensionFromFile(file: File) {
  const fromName = path.extname(file.name || "").toLowerCase();
  if (fromName) {
    return fromName;
  }

  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/gif": ".gif",
    "image/avif": ".avif",
  };

  return map[file.type] ?? ".bin";
}

function shouldSkipImageProcessing(file: File) {
  return file.type === "image/svg+xml" || file.type === "image/gif";
}

async function prepareImageForStorage(file: File) {
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const originalExtension = extensionFromFile(file);
  const originalMimeType = file.type || "application/octet-stream";

  if (shouldSkipImageProcessing(file)) {
    return {
      buffer: originalBuffer,
      extension: originalExtension,
      mimeType: originalMimeType,
      sizeBytes: originalBuffer.byteLength,
    };
  }

  try {
    const image = sharp(originalBuffer, { failOn: "none" }).rotate();
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const isLarge =
      originalBuffer.byteLength > LARGE_IMAGE_BYTES ||
      width > MAX_IMAGE_DIMENSION ||
      height > MAX_IMAGE_DIMENSION;

    if (!isLarge) {
      return {
        buffer: originalBuffer,
        extension: originalExtension,
        mimeType: originalMimeType,
        sizeBytes: originalBuffer.byteLength,
      };
    }

    const processedBuffer = await image
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 5, smartSubsample: true })
      .toBuffer();

    return {
      buffer: processedBuffer,
      extension: ".webp",
      mimeType: "image/webp",
      sizeBytes: processedBuffer.byteLength,
    };
  } catch {
    return {
      buffer: originalBuffer,
      extension: originalExtension,
      mimeType: originalMimeType,
      sizeBytes: originalBuffer.byteLength,
    };
  }
}

async function saveImageUpload(file: File, folder: string, fallbackBaseName: string) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image must be 10 MB or smaller.");
  }

  const outputDir = path.join(UPLOADS_ROOT_DIR, folder);
  await mkdir(outputDir, { recursive: true });

  const prepared = await prepareImageForStorage(file);
  const extension = prepared.extension;
  const baseName = sanitizeBaseName(file.name || fallbackBaseName);
  const filename = `${baseName}-${randomUUID()}${extension}`;
  const outputPath = path.join(outputDir, filename);

  await writeFile(outputPath, prepared.buffer);

  return {
    filename,
    extension,
    mimeType: prepared.mimeType,
    sizeBytes: prepared.sizeBytes,
    publicPath: `/uploads/${folder}/${filename}`,
    storageKey: `uploads/${folder}/${filename}`,
  };
}

export async function saveProductImageUpload(file: File) {
  return saveImageUpload(file, "products", "product-image");
}

export async function saveCollectionImageUpload(file: File) {
  return saveImageUpload(file, "collections", "collection-image");
}
