import "server-only";

import { db } from "@/lib/db";

export type StoredShopifyCustomerSession = {
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

export async function findStoredCustomerSession(id: string) {
  const rows = await db.$queryRaw<StoredShopifyCustomerSession[]>`
    SELECT "id", "accessToken", "refreshToken", "idToken",
           "accessTokenExpiresAt", "sessionExpiresAt", "lastSeenAt", "createdAt", "updatedAt"
    FROM "ShopifyCustomerSession"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
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
  await db.$executeRaw`
    INSERT INTO "ShopifyCustomerSession"
      ("id", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "sessionExpiresAt", "lastSeenAt", "createdAt", "updatedAt")
    VALUES
      (${input.id}, ${input.accessToken}, ${input.refreshToken}, ${input.idToken}, ${input.accessTokenExpiresAt}, ${input.sessionExpiresAt}, NOW(), NOW(), NOW())
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
  await db.$executeRaw`
    UPDATE "ShopifyCustomerSession"
    SET
      "accessToken" = ${input.accessToken},
      "refreshToken" = ${input.refreshToken},
      "idToken" = ${input.idToken},
      "accessTokenExpiresAt" = ${input.accessTokenExpiresAt},
      "lastSeenAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

export async function touchStoredCustomerSession(id: string) {
  await db.$executeRaw`
    UPDATE "ShopifyCustomerSession" SET "lastSeenAt" = NOW() WHERE "id" = ${id}
  `;
}

export async function deleteStoredCustomerSession(id: string) {
  await db.$executeRaw`
    DELETE FROM "ShopifyCustomerSession"
    WHERE "id" = ${id}
  `;
}
