import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type WorkspaceCredential = {
  readonly workspaceKey: string;
  readonly tokenHash: string;
  readonly salt: string;
};

/**
 * Hash a service token for storage. Browser never receives this secret.
 * Format stored in env: workspaceKey:saltHex:hashHex (comma-separated entries).
 */
export function hashServiceToken(token: string, salt = randomBytes(16)): WorkspaceCredential["tokenHash"] {
  return scryptSync(token, salt, 32).toString("hex");
}

export function createCredential(
  workspaceKey: string,
  token: string,
): WorkspaceCredential {
  const salt = randomBytes(16);
  return {
    workspaceKey,
    salt: salt.toString("hex"),
    tokenHash: hashServiceToken(token, salt),
  };
}

export function verifyServiceToken(
  token: string,
  credential: WorkspaceCredential,
): boolean {
  const salt = Buffer.from(credential.salt, "hex");
  const expected = Buffer.from(credential.tokenHash, "hex");
  const actual = scryptSync(token, salt, 32);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Parse `SKU_API_CREDENTIALS=workspace:salt:hash,workspace2:salt2:hash2` */
export function parseCredentialsEnv(raw: string | undefined): WorkspaceCredential[] {
  if (!raw?.trim()) return [];
  return raw.split(",").flatMap((entry) => {
    const parts = entry.trim().split(":");
    if (parts.length !== 3) return [];
    const [workspaceKey, salt, tokenHash] = parts;
    if (!workspaceKey || !salt || !tokenHash) return [];
    return [{ workspaceKey, salt, tokenHash }];
  });
}

export function digestPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

export type AuthResult =
  | { readonly ok: true; readonly workspaceKey: string }
  | { readonly ok: false; readonly status: 401 | 403; readonly message: string };

export function authenticateRequest(input: {
  readonly authorizationHeader: string | undefined;
  readonly pathWorkspaceKey: string;
  readonly credentials: readonly WorkspaceCredential[];
}): AuthResult {
  const header = input.authorizationHeader ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return { ok: false, status: 401, message: "missing Bearer token" };
  }
  const token = match[1]!.trim();
  if (!token) {
    return { ok: false, status: 401, message: "empty Bearer token" };
  }

  const credential = input.credentials.find(
    (c) => c.workspaceKey === input.pathWorkspaceKey,
  );
  if (!credential) {
    return { ok: false, status: 403, message: "workspace not authorized" };
  }
  if (!verifyServiceToken(token, credential)) {
    return { ok: false, status: 401, message: "invalid token" };
  }
  return { ok: true, workspaceKey: input.pathWorkspaceKey };
}
