import "server-only";

import { db } from "@/lib/db";

export type StoredShopifyCustomerSession = {
  id: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export async function findStoredCustomerSession(id: string) {
  const rows = await db.$queryRaw<StoredShopifyCustomerSession[]>`
    SELECT "id", "accessToken", "refreshToken", "idToken", "expiresAt", "createdAt", "updatedAt"
    FROM "ShopifyCustomerSession"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createStoredCustomerSession(input: {
  id: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: Date;
}) {
  await db.$executeRaw`
    INSERT INTO "ShopifyCustomerSession"
      ("id", "accessToken", "refreshToken", "idToken", "expiresAt", "createdAt", "updatedAt")
    VALUES
      (${input.id}, ${input.accessToken}, ${input.refreshToken}, ${input.idToken}, ${input.expiresAt}, NOW(), NOW())
  `;
}

export async function updateStoredCustomerSession(
  id: string,
  input: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
    expiresAt: Date;
  },
) {
  await db.$executeRaw`
    UPDATE "ShopifyCustomerSession"
    SET
      "accessToken" = ${input.accessToken},
      "refreshToken" = ${input.refreshToken},
      "idToken" = ${input.idToken},
      "expiresAt" = ${input.expiresAt},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

export async function deleteStoredCustomerSession(id: string) {
  await db.$executeRaw`
    DELETE FROM "ShopifyCustomerSession"
    WHERE "id" = ${id}
  `;
}
