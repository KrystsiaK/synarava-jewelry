import { createSign } from "node:crypto";

/**
 * Shared Google service-account JWT + token cache (node:crypto only).
 * Used by Calendar (D) and Sheets (E). Never log tokens or keys.
 * @see https://developers.google.com/identity/protocols/oauth2/service-account
 */

export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_CALENDAR_EVENTS_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_SPREADSHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";

/** Host allowlist for Google marketing integrations. */
export const GOOGLE_MARKETING_ALLOWED_HOSTS = [
  "oauth2.googleapis.com",
  "www.googleapis.com",
] as const;

export type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

const tokenCacheByScope = new Map<string, CachedToken>();

export function clearGoogleTokenCacheForTests(): void {
  tokenCacheByScope.clear();
}

export function parseGoogleServiceAccountJson(
  raw: string | null | undefined,
): GoogleServiceAccount | null {
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

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function signGoogleServiceAccountJwt(
  sa: GoogleServiceAccount,
  scope: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): string {
  const header = b64urlJson({ alg: "RS256", typ: "JWT" });
  const claims = b64urlJson({
    iss: sa.client_email,
    scope,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  });
  const unsigned = `${header}.${claims}`;
  const sig = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(sa.private_key, "base64url");
  return `${unsigned}.${sig}`;
}

export function assertGoogleMarketingUrlAllowed(url: string): void {
  const host = new URL(url).hostname;
  if (
    !(GOOGLE_MARKETING_ALLOWED_HOSTS as readonly string[]).includes(host)
  ) {
    throw new Error(`Google host not allowlisted: ${host}`);
  }
}

export async function fetchGoogleAccessToken(input: {
  sa: GoogleServiceAccount;
  scope: string;
  fetchFn?: typeof fetch;
  nowMs?: number;
  forceRefresh?: boolean;
}): Promise<string> {
  const nowMs = input.nowMs ?? Date.now();
  const skewMs = 60_000;
  const cached = tokenCacheByScope.get(input.scope);
  if (
    !input.forceRefresh &&
    cached &&
    cached.expiresAtMs - skewMs > nowMs
  ) {
    return cached.accessToken;
  }

  const fetchFn = input.fetchFn ?? fetch;
  const assertion = signGoogleServiceAccountJwt(
    input.sa,
    input.scope,
    Math.floor(nowMs / 1000),
  );
  assertGoogleMarketingUrlAllowed(GOOGLE_OAUTH_TOKEN_URL);
  const response = await fetchFn(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status})`);
  }
  const body = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (typeof body.access_token !== "string" || !body.access_token) {
    throw new Error("Google token exchange returned no access_token");
  }
  const expiresInSec =
    typeof body.expires_in === "number" && body.expires_in > 0
      ? body.expires_in
      : 3600;
  tokenCacheByScope.set(input.scope, {
    accessToken: body.access_token,
    expiresAtMs: nowMs + expiresInSec * 1000,
  });
  return body.access_token;
}
