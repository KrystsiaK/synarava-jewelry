import type { NextConfig } from "next";

function hostnameFromUrl(value?: string) {
  if (!value) return null;

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function protocolFromUrl(value?: string) {
  if (!value) return null;

  try {
    const protocol = new URL(value).protocol.replace(":", "");
    return protocol === "http" || protocol === "https" ? protocol : null;
  } catch {
    return null;
  }
}

const s3PublicHostname =
  hostnameFromUrl(process.env.S3_PUBLIC_URL) ??
  hostnameFromUrl(process.env.S3_ENDPOINT) ??
  (process.env.S3_BUCKET && process.env.S3_REGION
    ? `${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`
    : null);
const s3PublicProtocol =
  protocolFromUrl(process.env.S3_PUBLIC_URL) ??
  protocolFromUrl(process.env.S3_ENDPOINT) ??
  "https";
const s3EndpointHostname = hostnameFromUrl(process.env.S3_ENDPOINT);
const s3EndpointProtocol = protocolFromUrl(process.env.S3_ENDPOINT) ?? "https";
// Private Railway Buckets redirect signed requests from the base S3 endpoint
// to a virtual-hosted URL: `${bucket}.${endpoint}`. Next's image optimizer
// validates that redirect target separately, so allow the exact bucket host.
const s3SignedBucketHostname =
  process.env.S3_BUCKET && s3EndpointHostname
    ? `${process.env.S3_BUCKET}.${s3EndpointHostname}`
    : null;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Admin image uploads are capped at 10 MB; leave only multipart overhead.
      bodySizeLimit: "12mb",
    },
  },
  images: {
    // Keep the variant matrix intentionally small: these widths cover the actual
    // layouts in the storefront without creating dozens of one-off transforms.
    deviceSizes: [360, 430, 640, 750, 828, 1080, 1440, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256],
    formats: ["image/webp"],
    qualities: [75, 85, 90],
    minimumCacheTTL: 31_536_000,
    maximumRedirects: 2,
    contentDispositionType: "inline",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
      {
        protocol: "https",
        hostname: "**.shopifycdn.com",
      },
      ...(s3PublicHostname
        ? [
            {
              protocol: s3PublicProtocol,
              hostname: s3PublicHostname,
            },
          ]
        : []),
      ...(s3SignedBucketHostname
        ? [
            {
              protocol: s3EndpointProtocol,
              hostname: s3SignedBucketHostname,
            },
          ]
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
