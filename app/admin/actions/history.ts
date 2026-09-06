"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import {
  asRecord,
  revalidateStorefront,
  snapshotNullableString,
  snapshotNumber,
  snapshotString,
  writeAuditLog,
  type AdminAuditEntityType,
  type AdminRecordHistoryState,
} from "./shared";
import { getSavedProductPayload } from "./products";
import { getSavedCollectionPayload } from "./collections";
import { getSavedPagePayload } from "./pages";
import { getSavedCategoryPayload } from "./categories";
import { getSavedTagPayload } from "./tags";

async function getCurrentRecordSnapshot(entityType: AdminAuditEntityType, entityId: string) {
  if (entityType === "PRODUCT") return getSavedProductPayload(entityId);
  if (entityType === "COLLECTION") return getSavedCollectionPayload(entityId);
  if (entityType === "PAGE") return getSavedPagePayload(entityId);
  if (entityType === "CATEGORY") return getSavedCategoryPayload(entityId);
  return getSavedTagPayload(entityId);
}

export async function getAdminRecordHistoryAction(input: {
  entityType: AdminAuditEntityType;
  entityId: string;
}): Promise<AdminRecordHistoryState> {
  await requireAdminSession("/admin");

  const history = await db.auditLog.findMany({
    where: {
      entityType: input.entityType,
      entityId: input.entityId,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      action: true,
      createdAt: true,
    },
  });

  return { history };
}

export async function restoreAdminRecordVersionAction(input: {
  entityType: AdminAuditEntityType;
  entityId: string;
  auditLogId: string;
}): Promise<AdminRecordHistoryState> {
  await requireAdminSession("/admin");

  const auditLog = await db.auditLog.findFirst({
    where: {
      id: input.auditLogId,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });

  if (!auditLog?.after) {
    return { error: "This history item cannot be restored." };
  }

  const before = await getCurrentRecordSnapshot(input.entityType, input.entityId);
  const snapshot = asRecord(auditLog.after);

  try {
    if (input.entityType === "TAG") {
      await db.tag.update({
        where: { id: input.entityId },
        data: {
          slug: snapshotString(snapshot, "slug"),
          name: snapshotString(snapshot, "name"),
        },
      });
      revalidatePath("/admin/tags");
      revalidatePath("/admin/products");
    }

    if (input.entityType === "CATEGORY") {
      await db.productCategory.update({
        where: { id: input.entityId },
        data: {
          slug: snapshotString(snapshot, "slug"),
          name: snapshotString(snapshot, "name"),
          description: snapshotNullableString(snapshot, "description"),
          sortOrder: snapshotNumber(snapshot, "sortOrder"),
        },
      });
      revalidatePath("/admin/categories");
      revalidatePath("/admin/products");
    }

    if (input.entityType === "PAGE") {
      await db.page.update({
        where: { id: input.entityId },
        data: {
          slug: snapshotString(snapshot, "slug"),
          title: snapshotString(snapshot, "title"),
          excerpt: snapshotNullableString(snapshot, "excerpt"),
          content: snapshot.content ?? Prisma.JsonNull,
          status: snapshotString(snapshot, "status") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
          visibility: snapshotString(snapshot, "visibility") as "PRIVATE" | "UNLISTED" | "PUBLIC",
        },
      });
      revalidatePath("/admin/pages");
    }

    if (input.entityType === "COLLECTION") {
      await db.collection.update({
        where: { id: input.entityId },
        data: {
          slug: snapshotString(snapshot, "slug"),
          code: snapshotNullableString(snapshot, "code"),
          name: snapshotString(snapshot, "name"),
          subtitle: snapshotNullableString(snapshot, "subtitle"),
          description: snapshotNullableString(snapshot, "description"),
          manifesto: snapshotNullableString(snapshot, "manifesto"),
          searchSummary: snapshotNullableString(snapshot, "searchSummary"),
          symbolismLabel: snapshotNullableString(snapshot, "symbolismLabel"),
          symbolismTitle: snapshotNullableString(snapshot, "symbolismTitle"),
          symbolismBody: snapshotNullableString(snapshot, "symbolismBody"),
          symbolismBody2: snapshotNullableString(snapshot, "symbolismBody2"),
          heroImageUrl: snapshotNullableString(snapshot, "heroImageUrl"),
          sortOrder: snapshotNumber(snapshot, "sortOrder"),
          status: snapshotString(snapshot, "status") as "DRAFT" | "ACTIVE" | "ARCHIVED",
          visibility: snapshotString(snapshot, "visibility") as "PRIVATE" | "UNLISTED" | "PUBLIC",
        },
      });
      revalidatePath("/admin/collections");
    }

    if (input.entityType === "PRODUCT") {
      const collectionIds = Array.isArray(snapshot.collections)
        ? snapshot.collections
            .map((item) => asRecord(asRecord(item).collection).id)
            .filter((id): id is string => typeof id === "string")
        : [];
      const tagIds = Array.isArray(snapshot.tags)
        ? snapshot.tags
            .map((item) => asRecord(asRecord(item).tag).id)
            .filter((id): id is string => typeof id === "string")
        : [];
      const category = asRecord(snapshot.category);

      await db.product.update({
        where: { id: input.entityId },
        data: {
          slug: snapshotString(snapshot, "slug"),
          sku: snapshotString(snapshot, "sku"),
          name: snapshotString(snapshot, "name"),
          seriesLabel: snapshotNullableString(snapshot, "seriesLabel"),
          shortDescription: snapshotNullableString(snapshot, "shortDescription"),
          description: snapshotNullableString(snapshot, "description"),
          materialLine: snapshotNullableString(snapshot, "materialLine"),
          symbolismLabel: snapshotNullableString(snapshot, "symbolismLabel"),
          symbolismTitle: snapshotNullableString(snapshot, "symbolismTitle"),
          symbolismBody: snapshotNullableString(snapshot, "symbolismBody"),
          symbolismBody2: snapshotNullableString(snapshot, "symbolismBody2"),
          details: snapshot.details ?? Prisma.JsonNull,
          imageUrl: snapshotNullableString(snapshot, "imageUrl"),
          priceCents: snapshotNumber(snapshot, "priceCents"),
          categoryId: typeof category.id === "string" ? category.id : null,
          status: snapshotString(snapshot, "status") as "DRAFT" | "ACTIVE" | "ARCHIVED",
          visibility: snapshotString(snapshot, "visibility") as "PRIVATE" | "UNLISTED" | "PUBLIC",
        },
      });

      await db.productCollection.deleteMany({ where: { productId: input.entityId } });
      for (const collectionId of collectionIds) {
        await db.productCollection.create({
          data: { productId: input.entityId, collectionId },
        });
      }

      await db.productTag.deleteMany({ where: { productId: input.entityId } });
      for (const tagId of tagIds) {
        await db.productTag.create({
          data: { productId: input.entityId, tagId },
        });
      }

      revalidatePath("/admin/products");
      revalidateStorefrontPath(`/products/${snapshotString(snapshot, "slug")}`);
    }

    const after = await getCurrentRecordSnapshot(input.entityType, input.entityId);
    await writeAuditLog({
      action: "RESTORE",
      entityType: input.entityType,
      entityId: input.entityId,
      before,
      after,
      metadata: { restoredFromAuditLogId: input.auditLogId },
    });

    revalidateStorefront();
    return { success: "Version restored. The table has been refreshed." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Version restore failed.",
    };
  }
}
