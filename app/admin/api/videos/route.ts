import { randomUUID } from "node:crypto";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getCurrentAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { getS3, getS3Bucket, getS3PublicUrl } from "@/lib/s3";
import { SITE_VIDEO_SETTING_KEY, siteVideoSlots, type SiteVideoSlot } from "@/lib/site-videos";

export const runtime = "nodejs";

const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

type PreparedUpload = {
  slot: SiteVideoSlot;
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

function isVideoSlot(value: unknown): value is SiteVideoSlot {
  return typeof value === "string" && value in siteVideoSlots;
}

function sanitizeBaseName(filename: string) {
  return filename
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "site-video";
}

function validateVideo(input: Record<string, unknown>) {
  if (!isVideoSlot(input.slot)) throw new Error("Unknown video placement.");
  if (typeof input.filename !== "string" || !input.filename) throw new Error("Video filename is missing.");
  if (typeof input.mimeType !== "string" || !VIDEO_TYPES.has(input.mimeType)) {
    throw new Error("Only MP4 and WebM video uploads are supported.");
  }
  if (typeof input.sizeBytes !== "number" || input.sizeBytes <= 0 || input.sizeBytes > MAX_VIDEO_BYTES) {
    throw new Error("Video must be 500 MB or smaller.");
  }
}

function isPreparedUpload(value: unknown): value is PreparedUpload {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return isVideoSlot(item.slot) &&
    typeof item.key === "string" && item.key.startsWith(`uploads/videos/${item.slot}/`) &&
    typeof item.filename === "string" &&
    typeof item.mimeType === "string" && VIDEO_TYPES.has(item.mimeType) &&
    typeof item.sizeBytes === "number" && item.sizeBytes > 0 && item.sizeBytes <= MAX_VIDEO_BYTES;
}

function revalidateStorefront() {
  for (const route of ["/", "/shop", "/collections", "/about", "/about/manifesto", "/admin/videos"]) {
    revalidatePath(route);
  }
  revalidatePath("/collections/[slug]", "page");
  revalidatePath("/products/[slug]", "page");
}

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return Response.json({ error: "Admin session expired." }, { status: 401 });

  try {
    const body = await request.json() as Record<string, unknown>;

    if (body.action === "prepare") {
      validateVideo(body);
      const slot = body.slot as SiteVideoSlot;
      const mimeType = body.mimeType as string;
      const sizeBytes = body.sizeBytes as number;
      const originalFilename = body.filename as string;
      const extension = VIDEO_TYPES.has(mimeType)
        ? (mimeType === "video/webm" ? ".webm" : ".mp4")
        : path.extname(originalFilename).toLowerCase();
      const filename = `${sanitizeBaseName(originalFilename)}-${randomUUID()}${extension}`;
      const key = `uploads/videos/${slot}/${filename}`;
      const uploadUrl = await getSignedUrl(
        getS3(),
        new PutObjectCommand({
          Bucket: getS3Bucket(),
          Key: key,
          ContentType: mimeType,
          CacheControl: IMMUTABLE_CACHE_CONTROL,
        }),
        { expiresIn: 15 * 60 },
      );

      return Response.json({ uploadUrl, upload: { slot, key, filename, mimeType, sizeBytes } });
    }

    if (body.action === "complete") {
      const uploads = Array.isArray(body.uploads) ? body.uploads.filter(isPreparedUpload) : [];
      if (uploads.length === 0) throw new Error("No completed video uploads were provided.");

      for (const upload of uploads) {
        const object = await getS3().send(new HeadObjectCommand({ Bucket: getS3Bucket(), Key: upload.key }));
        if (object.ContentLength !== upload.sizeBytes || object.ContentType !== upload.mimeType) {
          throw new Error(`Uploaded file verification failed for ${upload.filename}.`);
        }
      }

      const existing = await db.siteSetting.findUnique({
        where: { key: SITE_VIDEO_SETTING_KEY },
        select: { value: true },
      });
      const current = existing?.value && typeof existing.value === "object"
        ? { ...(existing.value as Prisma.InputJsonObject) }
        : {};

      await db.$transaction(async (tx) => {
        for (const upload of uploads) {
          current[upload.slot] = getS3PublicUrl(upload.key);
          await tx.mediaAsset.upsert({
            where: { key: upload.key },
            update: { status: "READY" },
            create: {
              key: upload.key,
              filename: upload.filename,
              mimeType: upload.mimeType,
              extension: path.extname(upload.filename).replace(/^\./, ""),
              sizeBytes: upload.sizeBytes,
              bucket: process.env.S3_BUCKET ?? null,
              source: "UPLOAD",
              status: "READY",
              uploadedById: session.id,
            },
          });
        }

        await tx.siteSetting.upsert({
          where: { key: SITE_VIDEO_SETTING_KEY },
          update: { value: current },
          create: { key: SITE_VIDEO_SETTING_KEY, value: current },
        });
      });

      revalidateStorefront();
      return Response.json({ count: uploads.length });
    }

    return Response.json({ error: "Unknown upload action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Video upload failed." },
      { status: 400 },
    );
  }
}
