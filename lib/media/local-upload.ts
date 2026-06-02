import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PRODUCT_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "products");

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

export async function saveProductImageUpload(file: File) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image must be 10 MB or smaller.");
  }

  await mkdir(PRODUCT_UPLOAD_DIR, { recursive: true });

  const extension = extensionFromFile(file);
  const baseName = sanitizeBaseName(file.name);
  const filename = `${baseName}-${randomUUID()}${extension}`;
  const outputPath = path.join(PRODUCT_UPLOAD_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(outputPath, buffer);

  return {
    filename,
    extension,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    publicPath: `/uploads/products/${filename}`,
    storageKey: `uploads/products/${filename}`,
  };
}
