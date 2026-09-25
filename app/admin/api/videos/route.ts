import { randomUUID } from "node:crypto";
import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getCurrentAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { revalidateStorefrontPath, revalidateStorefrontTemplate } from "@/lib/content/revalidate-storefront";
import { resolveSiteVideoMimeType } from "@/lib/media/video-mime";
import { getS3, getS3Bucket, getS3PublicUrl } from "@/lib/s3";
import { SITE_VIDEO_SETTING_KEY, siteVideoSlots, type SiteVideoSlot } from "@/lib/site-videos";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

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

function revalidateStorefront() {
  for (const route of ["/", "/shop", "/collections", "/about"]) {
    revalidateStorefrontPath(route);
  }
  revalidatePath("/admin/videos");
  revalidateStorefrontTemplate("/collections/[slug]");
  revalidateStorefrontTemplate("/products/[slug]");
}

/** Multipart upload through the app → S3 (no browser→bucket CORS). */
export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return Response.json({ error: "Admin session expired." }, { status: 401 });

  try {
    const formData = await request.formData();
    const selected = Object.keys(siteVideoSlots).flatMap((slot) => {
      if (!isVideoSlot(slot)) return [];
      const file = formData.get(slot);
      return file instanceof File && file.size > 0 ? [{ slot, file }] : [];
    });

    if (selected.length === 0) {
      throw new Error("Choose at least one MP4 or WebM video to upload.");
    }

    const prepared: Array<{
      slot: SiteVideoSlot;
      key: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
    }> = [];
    for (const { slot, file } of selected) {
      if (file.size > MAX_VIDEO_BYTES) {
        throw new Error(`“${file.name}” must be 100 MB or smaller.`);
      }

      const mimeType = resolveSiteVideoMimeType({ mimeType: file.type, filename: file.name });
      if (!mimeType) {
        throw new Error(`“${file.name}” is not a supported MP4 or WebM video.`);
      }

      const extension = mimeType === "video/webm" ? ".webm" : ".mp4";
      const filename = `${sanitizeBaseName(file.name)}-${randomUUID()}${extension}`;
      const key = `uploads/videos/${slot}/${filename}`;

      await getS3().send(
        new PutObjectCommand({
          Bucket: getS3Bucket(),
          Key: key,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: mimeType,
          CacheControl: IMMUTABLE_CACHE_CONTROL,
        }),
      );

      prepared.push({ slot, key, filename, mimeType, sizeBytes: file.size });
    }

    const existing = await db.siteSetting.findUnique({
      where: { key: SITE_VIDEO_SETTING_KEY },
      select: { value: true },
    });
    const current = existing?.value && typeof existing.value === "object"
      ? { ...(existing.value as Prisma.InputJsonObject) }
      : {};

    await db.$transaction(async (tx) => {
      for (const upload of prepared) {
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
            uploadedByUsername: session.username,
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
    return Response.json({ count: prepared.length });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Video upload failed." },
      { status: 400 },
    );
  }
}
