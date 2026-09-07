import { S3Client } from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;

type S3Environment = Record<string, string | undefined>;

export type S3Config = {
  region: string;
  bucket: string;
  endpoint: string | null;
  publicUrl: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  forcePathStyle: boolean;
  useProxy: boolean;
};

const LOCAL_S3_CONFIG: S3Config = {
  region: "us-east-1",
  bucket: "synarava-media",
  endpoint: "http://127.0.0.1:59000",
  publicUrl: null,
  accessKeyId: "synarava-local",
  secretAccessKey: "synarava-local-storage",
  forcePathStyle: true,
  useProxy: true,
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function resolveS3Config(source: S3Environment, nodeEnv = process.env.NODE_ENV): S3Config {
  const hasExplicitStorage = Boolean(source.S3_REGION || source.S3_BUCKET || source.S3_ENDPOINT);
  if (!hasExplicitStorage && nodeEnv !== "production") return LOCAL_S3_CONFIG;
  if (!source.S3_REGION || !source.S3_BUCKET) {
    throw new Error("S3 storage is not fully configured.");
  }

  return {
    region: source.S3_REGION,
    bucket: source.S3_BUCKET,
    endpoint: source.S3_ENDPOINT ?? null,
    publicUrl: source.S3_PUBLIC_URL ?? null,
    accessKeyId: source.S3_ACCESS_KEY_ID ?? null,
    secretAccessKey: source.S3_SECRET_ACCESS_KEY ?? null,
    forcePathStyle:
      source.S3_FORCE_PATH_STYLE === "true"
        ? true
        : source.S3_FORCE_PATH_STYLE === "false"
          ? false
          : Boolean(source.S3_ENDPOINT),
    useProxy: source.S3_USE_PROXY === "true",
  };
}

export function getS3Config() {
  return resolveS3Config(process.env);
}

export function getS3() {
  const config = getS3Config();

  if (!s3Client) {
    s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint ?? undefined,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
      forcePathStyle: config.forcePathStyle,
    });
  }

  return s3Client;
}

export function getS3Bucket() {
  return getS3Config().bucket;
}

export function getS3PublicUrl(key: string) {
  const normalizedKey = key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  const config = getS3Config();

  if (config.publicUrl) {
    return `${trimTrailingSlash(config.publicUrl)}/${normalizedKey}`;
  }

  if (config.useProxy) {
    return `/media/${normalizedKey}`;
  }

  if (config.endpoint) {
    return `${trimTrailingSlash(config.endpoint)}/${config.bucket}/${normalizedKey}`;
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${normalizedKey}`;
}
