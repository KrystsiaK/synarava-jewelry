import "server-only";

import { createHash } from "node:crypto";

import { db } from "@/lib/db";

export type StoredShopifyCustomerSession = {
  /** Cookie session id (raw). DB stores only sha256(hex) of this value. */
  id: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  accessTokenExpiresAt: Date;
  sessionExpiresAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type StoredShopifyCustomerSessionRow = Omit<StoredShopifyCustomerSession, "id"> & {
  id: string;
};

/** SHA-256 hex of the cookie value — what is stored as the row primary key. */
export function hashCustomerSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId, "utf8").digest("hex");
}

async function selectSessionByPk(pk: string) {
  const rows = await db.$queryRaw<StoredShopifyCustomerSessionRow[]>`
    SELECT "id", "accessToken", "refreshToken", "idToken",
           "accessTokenExpiresAt", "sessionExpiresAt", "lastSeenAt", "createdAt", "updatedAt"
    FROM "ShopifyCustomerSession"
    WHERE "id" = ${pk}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Promote a legacy plaintext primary key to sha256(cookieId).
 * Best-effort: concurrent promotes / already-hashed rows are ignored.
 */
async function promotePlaintextSessionId(cookieId: string, idHash: string) {
  if (cookieId === idHash) return;
  try {
    await db.$executeRaw`
      UPDATE "ShopifyCustomerSession"
      SET "id" = ${idHash}, "updatedAt" = NOW()
      WHERE "id" = ${cookieId}
    `;
  } catch {
    // Unique conflict or race — a hashed row may already exist.
  }
}

export async function findStoredCustomerSession(id: string) {
  const idHash = hashCustomerSessionId(id);
  const byHash = await selectSessionByPk(idHash);
  if (byHash) return { ...byHash, id };

  // Pre-hash deploy: row pk was the raw cookie. Dual-read so code can ship
  // before (or without) a batch SQL rewrite, then promote lazily.
  const byPlain = await selectSessionByPk(id);
  if (!byPlain) return null;
  await promotePlaintextSessionId(id, idHash);
  return { ...byPlain, id };
}

/** Idempotent: deletes only rows whose absolute session TTL has elapsed. Safe to call repeatedly. */
export async function cleanupExpiredCustomerSessions() {
  await db.$executeRaw`
    DELETE FROM "ShopifyCustomerSession" WHERE "sessionExpiresAt" <= NOW()
  `;
}

export async function createStoredCustomerSession(input: {
  id: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  accessTokenExpiresAt: Date;
  sessionExpiresAt: Date;
}) {
  await cleanupExpiredCustomerSessions();
  const idHash = hashCustomerSessionId(input.id);
  await db.$executeRaw`
    INSERT INTO "ShopifyCustomerSession"
      ("id", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "sessionExpiresAt", "lastSeenAt", "createdAt", "updatedAt")
    VALUES
      (${idHash}, ${input.accessToken}, ${input.refreshToken}, ${input.idToken}, ${input.accessTokenExpiresAt}, ${input.sessionExpiresAt}, NOW(), NOW(), NOW())
  `;
}

/** Updates only the Shopify tokens and access-token expiry. Never extends `sessionExpiresAt`. */
export async function updateStoredCustomerSessionTokens(
  id: string,
  input: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
    accessTokenExpiresAt: Date;
  },
) {
  const idHash = hashCustomerSessionId(id);
  await db.$executeRaw`
    UPDATE "ShopifyCustomerSession"
    SET
      "accessToken" = ${input.accessToken},
      "refreshToken" = ${input.refreshToken},
      "idToken" = ${input.idToken},
      "accessTokenExpiresAt" = ${input.accessTokenExpiresAt},
      "lastSeenAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "id" = ${idHash} OR "id" = ${id}
  `;
}

export async function touchStoredCustomerSession(id: string) {
  const idHash = hashCustomerSessionId(id);
  await db.$executeRaw`
    UPDATE "ShopifyCustomerSession"
    SET "lastSeenAt" = NOW()
    WHERE "id" = ${idHash} OR "id" = ${id}
  `;
}

export async function deleteStoredCustomerSession(id: string) {
  const idHash = hashCustomerSessionId(id);
  await db.$executeRaw`
    DELETE FROM "ShopifyCustomerSession"
    WHERE "id" = ${idHash} OR "id" = ${id}
  `;
}
