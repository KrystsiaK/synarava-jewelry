import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { getS3, getS3Bucket, getS3PublicUrl } from "@/lib/s3";

const MAX_IMAGE_DIMENSION = 2560;
const WEBP_QUALITY = 85;
const MAX_INPUT_PIXELS = 50_000_000;
const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

function sanitizeBaseName(filename: string) {
  return filename
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "product-image";
}

async function prepareImageForStorage(file: File) {
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(originalBuffer, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    }).rotate();
    const metadata = await image.metadata();
    if (!metadata.format || !ALLOWED_INPUT_FORMATS.has(metadata.format)) {
      throw new Error("Unsupported image encoding.");
    }
    const processed = await image
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 5, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: processed.data,
      extension: ".webp",
      mimeType: "image/webp",
      sizeBytes: processed.data.byteLength,
      width: processed.info.width || null,
      height: processed.info.height || null,
    };
  } catch {
    throw new Error("The uploaded file is not a valid JPEG, PNG, WebP, or AVIF image.");
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

export async function savePageImageUpload(file: File, pageSlug: string) {
  return saveImageUpload(file, "pages", `${pageSlug || "page"}-image`);
}
