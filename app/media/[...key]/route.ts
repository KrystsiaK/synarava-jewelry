import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

import { getS3, getS3Bucket } from "@/lib/s3";

export const runtime = "nodejs";

type Props = {
  params: Promise<{ key: string[] }>;
};

function isSafeUploadKey(parts: string[]) {
  return parts[0] === "uploads" && parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

export async function GET(request: Request, { params }: Props) {
  const { key } = await params;
  if (!isSafeUploadKey(key)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const range = request.headers.get("range") ?? undefined;
    const object = await getS3().send(new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: key.join("/"),
      Range: range,
    }));
    if (!object.Body) {
      return new Response("Not found", { status: 404 });
    }

    const body = Readable.toWeb(object.Body as Readable) as ReadableStream<Uint8Array>;
    const headers = new Headers({
      "Content-Type": object.ContentType ?? "application/octet-stream",
      "Cache-Control": object.CacheControl ?? "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    });
    if (object.ContentLength !== undefined) headers.set("Content-Length", object.ContentLength.toString());
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange);

    return new Response(body, { status: range ? 206 : 200, headers });
  } catch (error) {
    const status = error && typeof error === "object" && "$metadata" in error
      ? 404
      : 500;
    return new Response(status === 404 ? "Not found" : "Media request failed", { status });
  }
}
