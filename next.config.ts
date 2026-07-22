import type { NextConfig } from "next";

function originFromUrl(value?: string) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

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

const imageOrigins = [
  "https://lh3.googleusercontent.com",
  originFromUrl(process.env.S3_PUBLIC_URL),
  originFromUrl(process.env.S3_ENDPOINT),
  process.env.S3_BUCKET && process.env.S3_REGION
    ? `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`
    : null,
].filter((origin): origin is string => Boolean(origin));

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "55mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      ...(s3PublicHostname
        ? [
            {
              protocol: s3PublicProtocol,
              hostname: s3PublicHostname,
            },
          ]
        : []),
    ],
  },
  async headers() {
    // Note: script-src includes 'unsafe-inline' because Next.js injects inline scripts.
    // Development React diagnostics require eval for enhanced call stacks.
    // For full XSS protection, replace 'unsafe-inline' with a per-request nonce via middleware.
    const scriptSrc = [
      "'self'",
      "https://js.stripe.com",
      "'unsafe-inline'",
      ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]),
    ].join(" ");

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${imageOrigins.join(" ")}`,
      `media-src 'self' ${imageOrigins.join(" ")}`,
      "connect-src 'self' https://api.stripe.com",
      "frame-src https://js.stripe.com",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
