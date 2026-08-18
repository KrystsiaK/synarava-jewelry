import { randomBytes, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getShopifyCustomerAccountConfig,
  SHOPIFY_CUSTOMER_OAUTH_COOKIE,
  SHOPIFY_CUSTOMER_SESSION_COOKIE,
} from "@/lib/shopify/customer-account/config";
import {
  decryptCustomerSecret,
  encryptCustomerSecret,
} from "@/lib/shopify/customer-account/crypto";
import { getCustomerAuthorizationDiscovery } from "@/lib/shopify/customer-account/discovery";
import { verifyShopifyIdToken } from "@/lib/shopify/customer-account/id-token";
import { requestCustomerTokens } from "@/lib/shopify/customer-account/tokens";
import { createStoredCustomerSession } from "@/lib/shopify/customer-account/session-store";

export const runtime = "nodejs";

const transactionSchema = z.object({
  createdAt: z.number(),
  nonce: z.string().min(1),
  returnTo: z.string().startsWith("/"),
  state: z.string().min(1),
  verifier: z.string().min(43),
});

function equalSecret(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function loginError(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/login?error=shopify", request.url),
  );
  response.cookies.set(SHOPIFY_CUSTOMER_OAUTH_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/api/auth/shopify",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const storedTransaction = request.cookies.get(
    SHOPIFY_CUSTOMER_OAUTH_COOKIE,
  )?.value;

  if (!code || !returnedState || !storedTransaction) return loginError(request);

  try {
    const transaction = transactionSchema.parse(
      JSON.parse(decryptCustomerSecret(storedTransaction)),
    );
    if (
      Date.now() - transaction.createdAt > 10 * 60 * 1000 ||
      !equalSecret(transaction.state, returnedState)
    ) {
      return loginError(request);
    }

    const config = getShopifyCustomerAccountConfig();
    const discovery = await getCustomerAuthorizationDiscovery();
    const body = new URLSearchParams({
      client_id: config.clientId,
      code,
      code_verifier: transaction.verifier,
      grant_type: "authorization_code",
      redirect_uri: config.callbackUrl,
    });
    const tokens = await requestCustomerTokens(discovery.token_endpoint, body);
    if (!tokens.id_token) throw new Error("Shopify did not return an ID token.");

    await verifyShopifyIdToken({
      clientId: config.clientId,
      idToken: tokens.id_token,
      issuer: discovery.issuer,
      jwksUri: discovery.jwks_uri,
      nonce: transaction.nonce,
    });

    const sessionId = randomBytes(32).toString("base64url");
    await createStoredCustomerSession({
      id: sessionId,
      accessToken: encryptCustomerSecret(tokens.access_token),
      refreshToken: encryptCustomerSecret(tokens.refresh_token),
      idToken: encryptCustomerSecret(tokens.id_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    });

    const response = NextResponse.redirect(
      new URL(transaction.returnTo, config.appOrigin),
    );
    response.cookies.set(SHOPIFY_CUSTOMER_OAUTH_COOKIE, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/api/auth/shopify",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.set(SHOPIFY_CUSTOMER_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    console.error(
      "[shopify-customer-auth] Callback failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return loginError(request);
  }
}
