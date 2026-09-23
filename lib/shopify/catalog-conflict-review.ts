import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export type UnseenIncomingProductUpdate = { productId: string; updatedAt: string };

/** Advances the product's global incoming-update version. Every admin then sees it until they open that product. */
export async function markIncomingProductUpdates(productIds: string[]) {
  for (const productId of new Set(productIds)) {
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "ProductIncomingUpdate" ("productId", "version", "updatedAt")
      VALUES (${productId}, ${randomUUID()}, CURRENT_TIMESTAMP)
      ON CONFLICT ("productId") DO UPDATE
      SET "version" = EXCLUDED."version", "updatedAt" = CURRENT_TIMESTAMP
    `);
  }
}

export async function listUnseenIncomingProductUpdates(adminUsername: string): Promise<UnseenIncomingProductUpdate[]> {
  const rows = await db.$queryRaw<Array<{ productId: string; updatedAt: Date }>>(Prisma.sql`
    SELECT incoming."productId", incoming."updatedAt"
    FROM "ProductIncomingUpdate" incoming
    LEFT JOIN "ProductIncomingUpdateView" viewed
      ON viewed."productId" = incoming."productId"
      AND viewed."adminUsername" = ${adminUsername}
    WHERE viewed."viewedVersion" IS NULL OR viewed."viewedVersion" <> incoming."version"
    ORDER BY incoming."updatedAt" DESC
  `);
  return rows.map((row) => ({ productId: row.productId, updatedAt: row.updatedAt.toISOString() }));
}

/** Marks only this admin's view, using the current global version atomically. */
export async function markIncomingProductUpdateViewed(productId: string, adminUsername: string) {
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "ProductIncomingUpdateView" ("productId", "adminUsername", "viewedVersion", "viewedAt")
    SELECT incoming."productId", ${adminUsername}, incoming."version", CURRENT_TIMESTAMP
    FROM "ProductIncomingUpdate" incoming
    WHERE incoming."productId" = ${productId}
    ON CONFLICT ("productId", "adminUsername") DO UPDATE
    SET "viewedVersion" = EXCLUDED."viewedVersion", "viewedAt" = CURRENT_TIMESTAMP
  `);
}

