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

export async function GET(_request: Request, { params }: Props) {
  const { key } = await params;
  if (!isSafeUploadKey(key)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    // Redirect the browser (and Next's image optimizer) to Railway Object
    // Storage. This keeps private bucket credentials server-side while avoiding
    // double egress and memory pressure in the Next.js service. Range requests
    // for video are then handled natively by the bucket.
    const signedUrl = await getSignedUrl(
      getS3(),
      new GetObjectCommand({
        Bucket: getS3Bucket(),
        Key: key.join("/"),
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
