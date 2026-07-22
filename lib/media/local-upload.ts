import { randomUUID } from "node:crypto";
import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { getS3, getS3Bucket, getS3PublicUrl } from "@/lib/s3";

const MAX_IMAGE_DIMENSION = 3200;
const LARGE_IMAGE_BYTES = 4 * 1024 * 1024;
const WEBP_QUALITY = 94;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

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
    "video/mp4": ".mp4",
    "video/webm": ".webm",
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
      width: null,
      height: null,
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
        width: width || null,
        height: height || null,
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
      width: width || null,
      height: height || null,
    };
  } catch {
    return {
      buffer: originalBuffer,
      extension: originalExtension,
      mimeType: originalMimeType,
      sizeBytes: originalBuffer.byteLength,
      width: null,
      height: null,
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

  // SVG is rejected: it can contain <script> tags and would be served on the same
  // origin, creating a stored XSS vector. Use a raster format instead.
  if (file.type === "image/svg+xml") {
    throw new Error("SVG uploads are not supported. Please use JPEG, PNG, or WebP.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image must be 10 MB or smaller.");
  }

  const prepared = await prepareImageForStorage(file);
  const extension = prepared.extension;
  const baseName = sanitizeBaseName(file.name || fallbackBaseName);
  const filename = `${baseName}-${randomUUID()}${extension}`;
  const storageKey = `uploads/${folder}/${filename}`;

  await getS3().send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: storageKey,
      Body: prepared.buffer,
      ContentType: prepared.mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    filename,
    extension,
    mimeType: prepared.mimeType,
    sizeBytes: prepared.sizeBytes,
    width: prepared.width,
    height: prepared.height,
    publicPath: getS3PublicUrl(storageKey),
    storageKey,
  };
}

export async function saveProductImageUpload(file: File) {
  return saveImageUpload(file, "products", "product-image");
}

export async function saveCollectionImageUpload(file: File) {
  return saveImageUpload(file, "collections", "collection-image");
}

export async function saveSiteVideoUpload(file: File, slot: string) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!VIDEO_TYPES.has(file.type)) {
    throw new Error("Only MP4 and WebM video uploads are supported.");
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Video must be 50 MB or smaller.");
  }

  const extension = extensionFromFile(file);
  const baseName = sanitizeBaseName(file.name || `${slot}-video`);
  const filename = `${baseName}-${randomUUID()}${extension}`;
  const storageKey = `uploads/videos/${slot}/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await getS3().send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: storageKey,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    filename,
    extension,
    mimeType: file.type,
    sizeBytes: buffer.byteLength,
    publicPath: getS3PublicUrl(storageKey),
    storageKey,
  };
}
