import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getS3, getS3Bucket } from "@/lib/s3";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ key: string[] }>;
};

function isSafeUploadKey(parts: string[]) {
  return parts[0] === "uploads" && parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function isVideoKey(key: string) {
  return /\.(?:mp4|webm)$/i.test(key);
}

export async function GET(_request: Request, { params }: Props) {
  const { key } = await params;
  if (!isSafeUploadKey(key)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const storageKey = key.join("/");

    // Next's image optimizer resolves same-origin URLs internally and rejects a
    // redirect response as an invalid image. Stream images through this route
    // so the optimizer receives a 200 response with the original content type.
    if (!isVideoKey(storageKey)) {
      const object = await getS3().send(
        new GetObjectCommand({
          Bucket: getS3Bucket(),
          Key: storageKey,
        }),
      );

      if (!object.Body) {
        return new Response("Not found", { status: 404 });
      }

      const headers = new Headers({
        "Cache-Control": object.CacheControl ?? "public, max-age=31536000, immutable",
        "Content-Type": object.ContentType ?? "application/octet-stream",
      });

      if (object.ContentLength != null) {
        headers.set("Content-Length", String(object.ContentLength));
      }
      if (object.ETag) {
        headers.set("ETag", object.ETag);
      }
      if (object.LastModified) {
        headers.set("Last-Modified", object.LastModified.toUTCString());
      }

      return new Response(object.Body.transformToWebStream(), {
        status: 200,
        headers,
      });
    }

    // Keep large video responses on a signed redirect so Railway Object
    // Storage handles Range requests without double egress or extra memory.
    const signedUrl = await getSignedUrl(
      getS3(),
      new GetObjectCommand({
        Bucket: getS3Bucket(),
        Key: storageKey,
      }),
      { expiresIn: 60 * 60 },
    );

    return new Response(null, {
      status: 307,
      headers: {
        Location: signedUrl,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const status = error && typeof error === "object" && "$metadata" in error
      ? 404
      : 500;
    return new Response(status === 404 ? "Not found" : "Media request failed", { status });
  }
}
