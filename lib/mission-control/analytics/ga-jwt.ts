import "server-only";

import { createSign } from "node:crypto";

/**
 * Google service-account JWT for Analytics Data API (readonly).
 * Uses node:crypto only — no googleapis.
 * @see https://developers.google.com/identity/protocols/oauth2/service-account
 */
export type GaServiceAccount = {
  client_email: string;
  private_key: string;
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function parseGaServiceAccountJson(
  raw: string | null | undefined,
): GaServiceAccount | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const client_email =
      typeof parsed.client_email === "string" ? parsed.client_email : "";
    const private_key =
      typeof parsed.private_key === "string" ? parsed.private_key : "";
    if (!client_email || !private_key) return null;
    return { client_email, private_key };
  } catch {
    return null;
  }
}

export function signGaServiceAccountJwt(
  sa: GaServiceAccount,
  nowSec: number = Math.floor(Date.now() / 1000),
): string {
  const header = b64urlJson({ alg: "RS256", typ: "JWT" });
  const claims = b64urlJson({
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  });
  const unsigned = `${header}.${claims}`;
  const sig = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(sa.private_key, "base64url");
  return `${unsigned}.${sig}`;
}

export async function fetchGaAccessToken(
  sa: GaServiceAccount,
  fetchFn: typeof fetch = fetch,
  nowSec?: number,
): Promise<string> {
  const assertion = signGaServiceAccountJwt(sa, nowSec);
  const response = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`GA token exchange failed (${response.status})`);
  }
  const body = (await response.json()) as { access_token?: unknown };
  if (typeof body.access_token !== "string" || !body.access_token) {
    throw new Error("GA token exchange returned no access_token");
  }
  return body.access_token;
}
