import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_RETURN_TO_COOKIE,
  ADMIN_RETURN_TO_MAX_AGE_SECONDS,
  REQUEST_PATHNAME_HEADER,
  REQUEST_SEARCH_HEADER,
  adminReturnCookieOptions,
  getSafeAdminRedirect,
} from "@/lib/auth/admin-return-path";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

const ADMIN_COOKIE = "synarava-admin-session";
// Emergency fallback only, if the registry cache has never successfully
// loaded (e.g. DB unreachable on first request) — not the normal path.
const FALLBACK_DEFAULT_SEGMENT = "en";

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
    "https://www.googletagmanager.com",
    "https://connect.facebook.net",
    ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]),
  ].join(" ");
  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://cdn.shopify.com https://*.shopifycdn.com https://www.googletagmanager.com https://www.google-analytics.com https://www.facebook.com ${storage.join(" ")}`,
    `media-src 'self' blob: ${storage.join(" ")}`,
    `connect-src ${connections}`,
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

function rememberAdminReturnPath(response: NextResponse, returnPath: string) {
  response.cookies.set(
    ADMIN_RETURN_TO_COOKIE,
    getSafeAdminRedirect(returnPath),
    adminReturnCookieOptions(ADMIN_RETURN_TO_MAX_AGE_SECONDS),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
  // /media serves files by key (often without a file extension), so the
  // matcher's "contains a dot" exclusion doesn't catch it — exempt explicitly.
  const isLocaleExempt = isAdminPage || pathname.startsWith("/media");

  if (isAdminPage) {
    const isLogin = pathname === "/admin/login";
    if (!isLogin && !(await validAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value))) {
      const returnPath = `${pathname}${request.nextUrl.search}`;
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("redirectTo", returnPath);
      if (request.method === "POST" && request.headers.has("next-action")) {
        // A normal 307 preserves the Server Action POST and sends it to the
        // login page. The action client then receives HTML/404 instead of an
        // RSC redirect, which crashes long-lived admin tabs when their session
        // expires. Speak the Server Action redirect protocol directly so the
        // router performs a fresh navigation to login.
        const actionRedirect = new NextResponse(null, {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "text/plain; charset=utf-8",
            "x-action-redirect": `${login.pathname}${login.search};replace`,
          },
        });
        rememberAdminReturnPath(actionRedirect, returnPath);
        return actionRedirect;
      }
      const navigationStatus = request.method === "GET" || request.method === "HEAD" ? 307 : 303;
      const response = NextResponse.redirect(login, navigationStatus);
      rememberAdminReturnPath(response, returnPath);
      return response;
    }
  }

  const locales = isLocaleExempt ? [] : await getStorefrontLocales();
  // Registered (published or not) — an unpublished/disabled locale still
  // matches here so it reaches app/[locale]/layout.tsx and gets a real 404
  // via notFound() there, instead of being treated as a bare content path.
  // Empty registry (DB down / unseeded CI): treat the emergency fallback as
  // registered so `/en` is not rewritten to `/en/en` in a redirect loop.
  const registeredSegments =
    locales.length > 0
      ? locales.map((locale) => locale.routeSegment)
      : [FALLBACK_DEFAULT_SEGMENT];
  const firstSegment = isLocaleExempt ? null : pathname.split("/")[1] ?? "";
  const localeSegment = firstSegment && registeredSegments.includes(firstSegment) ? firstSegment : null;

  if (!isLocaleExempt && !localeSegment) {
    const publishedSegments = locales.filter((locale) => locale.isPublished).map((locale) => locale.routeSegment);
    const defaultSegment = locales.find((locale) => locale.isDefault)?.routeSegment ?? FALLBACK_DEFAULT_SEGMENT;
    const cookieLocale = request.cookies.get("synarava-locale")?.value;
    const hasValidCookie = typeof cookieLocale === "string" && publishedSegments.includes(cookieLocale);
    const target = hasValidCookie ? cookieLocale : defaultSegment;

    const url = request.nextUrl.clone();
    url.pathname = `/${target}${pathname === "/" ? "" : pathname}`;

    // A remembered preference is a personalized, non-cacheable redirect (307).
    // No cookie — what Googlebot and first-time visitors get — is the stable,
    // permanent mapping of every currently-indexed bare URL (308).
    return NextResponse.redirect(url, hasValidCookie ? 307 : 308);
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = cspFor(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set(REQUEST_PATHNAME_HEADER, pathname);
  requestHeaders.set(REQUEST_SEARCH_HEADER, request.nextUrl.search);
  if (localeSegment) {
    requestHeaders.set("x-locale", localeSegment);
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip proxy body cloning for admin API uploads (videos can exceed the
  // aligned 12 MB proxyClientMaxBodySize). Page Server Actions still go
  // through proxy with that cap; auth still runs inside each route handler.
  matcher: [{ source: "/((?!api|admin/api|_next/static|_next/image|favicon.ico|.*\\..*).*)", missing: [
    { type: "header", key: "next-router-prefetch" },
    { type: "header", key: "purpose", value: "prefetch" },
  ] }],
};
