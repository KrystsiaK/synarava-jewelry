import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getTrustedClientIp } from "@/lib/security/request-ip";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_768;

/**
 * Browser CSP violation sink (report-uri / Reporting API).
 * Soft: acknowledge + optional log; no side effects that can break the storefront.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-to
 */
export async function POST(request: Request) {
  const limit = await checkRateLimit(
    "csp-report",
    getTrustedClientIp(request.headers),
    { max: 60, windowMs: 60_000 },
  );
  if (!limit.ok) {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  if (process.env.CSP_REPORT_LOG === "1") {
    const contentType = request.headers.get("content-type") ?? "";
    console.info("[csp-report]", contentType, raw.slice(0, 2_000));
  }

  return new NextResponse(null, { status: 204 });
}

/** Some reporters probe with GET; stay quiet. */
export async function GET() {
  return new NextResponse(null, { status: 204 });
}
