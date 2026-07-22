import { S3Client } from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getS3() {
  if (!process.env.S3_REGION || !process.env.S3_BUCKET) {
    throw new Error("S3 storage is not fully configured.");
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
      forcePathStyle:
        process.env.S3_FORCE_PATH_STYLE === "true"
          ? true
          : process.env.S3_FORCE_PATH_STYLE === "false"
            ? false
            : Boolean(process.env.S3_ENDPOINT),
    });
  }

  return s3Client;
}

export function getS3Bucket() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3 bucket is not configured.");
  }

  return bucket;
}

export function getS3PublicUrl(key: string) {
  const normalizedKey = key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  if (process.env.S3_PUBLIC_URL) {
    return `${trimTrailingSlash(process.env.S3_PUBLIC_URL)}/${normalizedKey}`;
  }

  if (process.env.S3_USE_PROXY === "true") {
    return `/media/${normalizedKey}`;
  }

  const bucket = getS3Bucket();

  if (process.env.S3_ENDPOINT) {
    return `${trimTrailingSlash(process.env.S3_ENDPOINT)}/${bucket}/${normalizedKey}`;
  }

  const region = process.env.S3_REGION;
  if (!region) {
    throw new Error("S3 region is not configured.");
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${normalizedKey}`;
}
