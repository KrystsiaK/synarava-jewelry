import { describe, expect, it } from "vitest";

import { resolveS3Config } from "@/lib/s3";

describe("resolveS3Config", () => {
  it("uses the private local MinIO staging bucket in development", () => {
    expect(resolveS3Config({}, "development")).toEqual({
      region: "us-east-1",
      bucket: "synarava-media",
      endpoint: "http://127.0.0.1:59000",
      publicUrl: null,
      accessKeyId: "synarava-local",
      secretAccessKey: "synarava-local-storage",
      forcePathStyle: true,
      useProxy: true,
    });
  });

  it("never falls back to local credentials in production", () => {
    expect(() => resolveS3Config({}, "production")).toThrow("S3 storage is not fully configured");
  });

  it("preserves an explicitly configured S3-compatible provider", () => {
    expect(resolveS3Config({
      S3_REGION: "eu-west-1",
      S3_BUCKET: "media",
      S3_ENDPOINT: "https://objects.example.com",
      S3_PUBLIC_URL: "https://cdn.example.com",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
      S3_FORCE_PATH_STYLE: "false",
      S3_USE_PROXY: "false",
    }, "production")).toEqual({
      region: "eu-west-1",
      bucket: "media",
      endpoint: "https://objects.example.com",
      publicUrl: "https://cdn.example.com",
      accessKeyId: "key",
      secretAccessKey: "secret",
      forcePathStyle: false,
      useProxy: false,
    });
  });
});
