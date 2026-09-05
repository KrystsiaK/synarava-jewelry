import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "synarava-admin-session";

function origin(value?: string) {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

function secureOrigin(value?: string) {
  if (!value) return null;

  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function storageOrigins() {
  const values = new Set<string>();
  for (const value of [process.env.S3_PUBLIC_URL, process.env.S3_ENDPOINT]) {
    const parsed = origin(value);
    if (parsed) values.add(parsed);
  }
  if (process.env.S3_BUCKET && process.env.S3_REGION) {
    values.add(`https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`);
  }
  try {
    if (process.env.S3_BUCKET && process.env.S3_ENDPOINT) {
      const endpoint = new URL(process.env.S3_ENDPOINT);
      values.add(`${endpoint.protocol}//${process.env.S3_BUCKET}.${endpoint.hostname}`);
    }
  } catch {
    // Ignore invalid optional storage configuration.
  }
  return [...values];
}

function cspFor(nonce: string) {
  const storage = storageOrigins();
  const checkoutOrigin = secureOrigin(
    process.env.NEXT_PUBLIC_SHOPIFY_CHECKOUT_ROOT_DOMAIN,
  );
  const connections = [
    "'self'",
    "https://api.stripe.com",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://www.facebook.com",
    ...(checkoutOrigin ? [checkoutOrigin] : []),
    ...storage,
  ].join(" ");
  const scripts = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://js.stripe.com",
    "https://www.googletagmanager.com",
    "https://connect.facebook.net",
    ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]),
  ].join(" ");
  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://cdn.shopify.com https://*.shopifycdn.com https://www.google-analytics.com https://www.facebook.com ${storage.join(" ")}`,
    `media-src 'self' ${storage.join(" ")}`,
    `connect-src ${connections}`,
    "frame-src https://js.stripe.com",
    "font-src 'self' data: https://cdn.shopify.com https://*.shopifycdn.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

async function validAdminCookie(value: string | undefined) {
  if (!value) return false;
  const [sessionId, token, signature, ...rest] = value.split(".");
  if (rest.length || !sessionId || !token || !signature) return false;
  if (!/^[0-9a-f]{64}$/i.test(token) || !/^[0-9a-f]{64}$/i.test(signature)) return false;

  const secret = process.env.ADMIN_SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "synarava-dev-admin-secret-do-not-use-in-production");
  if (!secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    Uint8Array.from(signature.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)),
    new TextEncoder().encode(`${sessionId}.${token}`),
  );
}

export async function proxy(request: NextRequest) {
  const isAdminPage = request.nextUrl.pathname.startsWith("/admin");
  const isLogin = request.nextUrl.pathname === "/admin/login";
  if (isAdminPage && !isLogin && !(await validAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value))) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("redirectTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = cspFor(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [{ source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)", missing: [
    { type: "header", key: "next-router-prefetch" },
    { type: "header", key: "purpose", value: "prefetch" },
  ] }],
};
