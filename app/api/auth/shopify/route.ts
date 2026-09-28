import { createHash, randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  getShopifyCustomerAccountConfig,
  safeCustomerReturnPath,
  SHOPIFY_CUSTOMER_OAUTH_COOKIE,
} from "@/lib/shopify/customer-account/config";
import { encryptCustomerSecret } from "@/lib/shopify/customer-account/crypto";
import { getCustomerAuthorizationDiscovery } from "@/lib/shopify/customer-account/discovery";

export const runtime = "nodejs";

/**
 * Only a top-level browser navigation may mint PKCE state. Prefetch and RSC
 * fetches of this same-origin URL would set a second cookie and race the
 * `state` Shopify returns. connect-src also blocks those fetches from
 * following the redirect to Shopify.
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src
 */
function isLocalDevHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isCustomerAuthDocumentNavigation(request: NextRequest) {
  if (
    request.headers.has("rsc") ||
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-segment-prefetch") ||
    request.headers.get("purpose") === "prefetch"
  ) {
    return false;
  }

  const destination = request.headers.get("sec-fetch-dest");
  const mode = request.headers.get("sec-fetch-mode");
  if (!destination && !mode) return true;
  return destination === "document" && mode === "navigate";
}

export async function GET(request: NextRequest) {
  if (!isCustomerAuthDocumentNavigation(request)) {
    return new NextResponse(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }

  const config = getShopifyCustomerAccountConfig();
  // The OAuth cookie is host-only. Shopify sends the browser to APP_URL's
  // callback, so a localhost start would store state where the callback
  // never looks and the sign-in fails before the email screen.
  const callbackHost = new URL(config.appOrigin).hostname;
  if (isLocalDevHost(request.nextUrl.hostname) && request.nextUrl.hostname !== callbackHost) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, config.appOrigin);
    const response = NextResponse.redirect(target);
    response.headers.set("cache-control", "no-store");
    return response;
  }
  const discovery = await getCustomerAuthorizationDiscovery();
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const returnTo = safeCustomerReturnPath(
    request.nextUrl.searchParams.get("returnTo"),
  );

  const authorizationUrl = new URL(discovery.authorization_endpoint);
  authorizationUrl.searchParams.set(
    "scope",
    "openid email customer-account-api:full",
  );
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", config.callbackUrl);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);
  authorizationUrl.searchParams.set("code_challenge", challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  const transaction = encryptCustomerSecret(
    JSON.stringify({
      createdAt: Date.now(),
      nonce,
      returnTo,
      state,
      verifier,
    }),
  );
  const response = NextResponse.redirect(authorizationUrl);
  response.headers.set("cache-control", "no-store");
  response.cookies.set(SHOPIFY_CUSTOMER_OAUTH_COOKIE, transaction, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/api/auth/shopify",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
