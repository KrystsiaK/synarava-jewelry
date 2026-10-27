/**
 * Archive Synarava entities before destructive sync resolutions (PR-8).
 * Same transaction as the delete — result reports "archived, restorable".
 */

import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export type ArchiveCollectionResult = {
  archiveId: string;
  message: "archived, restorable";
};

/**
 * Copy a collection + dependants into SyncEntityArchive, then delete the live row.
 * Must be the only destructive collection path (guarded in tests).
 */
export async function archiveAndDeleteCollection(input: {
  collectionId: string;
  reason: string;
  archivedBy?: string | null;
}): Promise<ArchiveCollectionResult> {
  return db.$transaction(async (tx) => {
    const collection = await tx.collection.findUnique({
      where: { id: input.collectionId },
      include: {
        translations: true,
        products: true,
        sections: true,
      },
    });
    if (!collection) {
      throw new Error(`Collection ${input.collectionId} was not found for archive.`);
    }

    const bindings = await tx.shopifyTranslationBinding.findMany({
      where: { resourceType: "COLLECTION", entityId: input.collectionId },
    });

    const archive = await tx.syncEntityArchive.create({
      data: {
        resourceType: "COLLECTION",
        entityId: input.collectionId,
        reason: input.reason,
        archivedBy: input.archivedBy ?? null,
        payload: {
          collection,
          bindings,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.shopifyTranslationBinding.deleteMany({
      where: { resourceType: "COLLECTION", entityId: input.collectionId },
    });
    await tx.collection.delete({ where: { id: input.collectionId } });

    const remaining = await tx.collection.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { name: "asc" }],
      select: { id: true },
    });
    await Promise.all(
      remaining.map((row, index) =>
        tx.collection.update({
          where: { id: row.id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );

    return { archiveId: archive.id, message: "archived, restorable" as const };
  });
}
