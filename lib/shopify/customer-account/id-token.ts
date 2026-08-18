import "server-only";

import { createPublicKey, verify } from "node:crypto";
import { z } from "zod";

const headerSchema = z.object({
  alg: z.literal("RS256"),
  kid: z.string().min(1),
});

const claimsSchema = z.object({
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number(),
  iat: z.number(),
  iss: z.string().url(),
  nonce: z.string(),
  sub: z.string().min(1),
});

const jwksSchema = z.object({
  keys: z.array(
    z.object({
      alg: z.string().optional(),
      e: z.string(),
      kid: z.string(),
      kty: z.literal("RSA"),
      n: z.string(),
      use: z.string().optional(),
    }),
  ),
});

function decodeJsonPart(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
}

export async function verifyShopifyIdToken({
  clientId,
  idToken,
  issuer,
  jwksUri,
  nonce,
}: {
  clientId: string;
  idToken: string;
  issuer: string;
  jwksUri: string;
  nonce: string;
}) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Shopify ID token.");

  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = headerSchema.parse(decodeJsonPart(encodedHeader));
  const claims = claimsSchema.parse(decodeJsonPart(encodedClaims));
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = Math.floor(Date.now() / 1000);

  if (
    !audience.includes(clientId) ||
    claims.iss.replace(/\/$/, "") !== issuer.replace(/\/$/, "") ||
    claims.nonce !== nonce ||
    claims.exp <= now ||
    claims.iat > now + 60
  ) {
    throw new Error("Shopify ID token claims are invalid.");
  }

  const jwksResponse = await fetch(jwksUri, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!jwksResponse.ok) throw new Error("Unable to load Shopify signing keys.");

  const jwks = jwksSchema.parse(await jwksResponse.json());
  const jwk = jwks.keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new Error("Shopify signing key was not found.");

  const publicKey = createPublicKey({
    format: "jwk",
    key: jwk,
  });
  const valid = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedClaims}`, "utf8"),
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
  );

  if (!valid) throw new Error("Shopify ID token signature is invalid.");
  return claims;
}
