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

export async function GET(request: NextRequest) {
  const config = getShopifyCustomerAccountConfig();
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
  response.cookies.set(SHOPIFY_CUSTOMER_OAUTH_COOKIE, transaction, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/api/auth/shopify",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
