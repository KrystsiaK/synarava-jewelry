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

export async function findStoredCustomerSession(id: string) {
  const idHash = hashCustomerSessionId(id);
  const rows = await db.$queryRaw<StoredShopifyCustomerSessionRow[]>`
    SELECT "id", "accessToken", "refreshToken", "idToken",
           "accessTokenExpiresAt", "sessionExpiresAt", "lastSeenAt", "createdAt", "updatedAt"
    FROM "ShopifyCustomerSession"
    WHERE "id" = ${idHash}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  // Rewrite id to the cookie value so callers keep passing the raw id into
  // update/delete/touch (which hash again at the store boundary).
  return { ...row, id };
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
    WHERE "id" = ${idHash}
  `;
}

export async function touchStoredCustomerSession(id: string) {
  const idHash = hashCustomerSessionId(id);
  await db.$executeRaw`
    UPDATE "ShopifyCustomerSession" SET "lastSeenAt" = NOW() WHERE "id" = ${idHash}
  `;
}

export async function deleteStoredCustomerSession(id: string) {
  const idHash = hashCustomerSessionId(id);
  await db.$executeRaw`
    DELETE FROM "ShopifyCustomerSession"
    WHERE "id" = ${idHash}
  `;
}
