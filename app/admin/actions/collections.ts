"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { slugify } from "@/lib/text/slug";
import { saveCollectionImageUpload } from "@/lib/media/local-upload";
import {
  createDraftToken,
  hasMeaningfulDraftInput,
  revalidateStorefront,
  writeAuditLog,
  type DraftAutosaveResult,
} from "./shared";

export type CollectionActionState = {
  error?: string;
  success?: string;
  resetKey?: number;
  fieldErrors?: Partial<Record<CollectionFieldName, string>>;
  collection?: SavedCollectionPayload;
  collections?: SavedCollectionPayload[];
  deletedCollectionId?: string;
};

export type CollectionFieldName =
  | "name"
  | "slug"
  | "code"
  | "description"
  | "manifesto"
  | "searchSummary"
  | "workflowState"
  | "heroImageFile";

export type SavedCollectionPayload = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  slug: string;
  code: string | null;
  subtitle: string | null;
  description: string | null;
  manifesto: string | null;
  searchSummary: string | null;
  symbolismLabel: string | null;
  symbolismTitle: string | null;
  symbolismBody: string | null;
  symbolismBody2: string | null;
  heroImageUrl: string | null;
  sortOrder: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
};

const savedCollectionSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  slug: true,
  code: true,
  subtitle: true,
  description: true,
  manifesto: true,
  searchSummary: true,
  symbolismLabel: true,
  symbolismTitle: true,
  symbolismBody: true,
  symbolismBody2: true,
  heroImageUrl: true,
  sortOrder: true,
  status: true,
  visibility: true,
} satisfies Prisma.CollectionSelect;

async function listSavedCollections(client: Prisma.TransactionClient | typeof db = db) {
  return client.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { name: "asc" }],
    select: savedCollectionSelect,
  });
}

async function resequenceCollections(
  tx: Prisma.TransactionClient,
  collections: Array<{ id: string }>,
) {
  await Promise.all(
    collections.map((collection, index) =>
      tx.collection.update({
        where: { id: collection.id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );
}

export async function getSavedCollectionPayload(collectionId: string): Promise<SavedCollectionPayload> {
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: savedCollectionSelect,
  });

  if (!collection) {
    throw new Error("Collection not found.");
  }

  return collection;
}

function validateCollectionInput(input: {
  name: string;
  slug: string;
  code: string;
  description: string;
  manifesto: string;
  searchSummary: string;
  workflowState: string;
  hasHeroImage: boolean;
}) {
  const fieldErrors: Partial<Record<CollectionFieldName, string>> = {};

  if (!input.name) {
    fieldErrors.name = "Collection name is required.";
  }

  if (!input.slug) {
    fieldErrors.slug = "Slug is required.";
  }

  if (!input.code) {
    fieldErrors.code = "Collection code is required.";
  }

  if (!input.description) {
    fieldErrors.description = "Collection summary is required.";
  }

  if (!input.manifesto) {
    fieldErrors.manifesto = "Manifesto is required.";
  }

  if (!input.searchSummary) {
    fieldErrors.searchSummary = "Search summary is required.";
  }

  if (!input.hasHeroImage) {
    fieldErrors.heroImageFile = "Hero image is required.";
  }

  if (input.workflowState !== "DRAFT" && input.workflowState !== "PUBLISHED") {
    fieldErrors.workflowState = "Choose Draft or Published.";
  }

  return fieldErrors;
}

// Requiredness for these fields is reported per-field (see
// validateCollectionInput's fieldErrors), not as a single pass/fail, so
// this schema only extracts and trims — it deliberately has no `.min(1)`
// of its own.
const collectionFieldsSchema = z.object({
  collectionId: z.string().trim().default(""),
  slug: z.string().trim().default(""),
  code: z.string().trim().default(""),
  name: z.string().trim().default(""),
  description: z.string().trim().default(""),
  manifesto: z.string().trim().default(""),
  searchSummary: z.string().trim().default(""),
  symbolismLabel: z.string().trim().default(""),
  symbolismTitle: z.string().trim().default(""),
  symbolismBody: z.string().trim().default(""),
  symbolismBody2: z.string().trim().default(""),
  removeHeroImage: z.string().trim().default(""),
  existingHeroImageUrl: z.string().trim().default(""),
  workflowState: z.string().trim().default("DRAFT"),
});

export async function saveCollectionAction(
  _prevState: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  const currentUser = await requireAdminSession("/admin/collections");

  const parsed = parseFormData(formData, collectionFieldsSchema);
  if (!parsed.success) {
    return { error: "Please fix the required fields and try again." };
  }
  const {
    collectionId, code, name, description, manifesto, searchSummary,
    symbolismLabel, symbolismTitle, symbolismBody, symbolismBody2, workflowState,
  } = parsed.data;
  const slug = slugify(parsed.data.slug);
  const removeHeroImage = parsed.data.removeHeroImage === "1";
  const existingHeroImageUrl = removeHeroImage ? "" : parsed.data.existingHeroImageUrl;
  // FormData File values are dropped to "" by parseFormData, so the image
  // file itself is read directly from the original FormData, not the
  // parsed schema output.
  const imageFile = formData.get("heroImageFile");

  const fieldErrors = validateCollectionInput({
    name,
    slug,
    code,
    description,
    manifesto,
    searchSummary,
    workflowState,
    hasHeroImage: Boolean(
      existingHeroImageUrl || (imageFile instanceof File && imageFile.size > 0),
    ),
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please fix the required fields and try again.",
      fieldErrors,
    };
  }

  let heroImageUrl = existingHeroImageUrl || null;
  let uploadedAssetId: string | null = null;

  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const uploaded = await saveCollectionImageUpload(imageFile);
      if (uploaded) {
        heroImageUrl = uploaded.publicPath;
        const asset = await db.mediaAsset.create({
          data: {
            key: uploaded.storageKey,
            filename: uploaded.filename,
            mimeType: uploaded.mimeType,
            extension: uploaded.extension.replace(/^\./, ""),
            sizeBytes: uploaded.sizeBytes,
            width: uploaded.width,
            height: uploaded.height,
            bucket: process.env.S3_BUCKET ?? null,
            source: "UPLOAD",
            status: "READY",
            uploadedByUsername: currentUser?.username ?? null,
          },
          select: { id: true },
        });
        uploadedAssetId = asset.id;
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Collection image upload failed.",
      };
    }
  }

  const isPublished = workflowState === "PUBLISHED";
  const before = collectionId ? await getSavedCollectionPayload(collectionId).catch(() => null) : null;

  const baseData = {
    slug,
    code: code || null,
    name,
    description: description || null,
    manifesto: manifesto || null,
    searchSummary: searchSummary || null,
    symbolismLabel: symbolismLabel || null,
    symbolismTitle: symbolismTitle || null,
    symbolismBody: symbolismBody || null,
    symbolismBody2: symbolismBody2 || null,
    heroImageUrl,
    ...(uploadedAssetId ? { heroAssetId: uploadedAssetId } : {}),
    status: (isPublished ? "ACTIVE" : "DRAFT") as "DRAFT" | "ACTIVE",
    visibility: (isPublished ? "PUBLIC" : "PRIVATE") as "PRIVATE" | "PUBLIC",
    publishedAt: isPublished ? new Date() : null,
  };

  const savedCollection = collectionId
    ? await db.collection.update({
        where: { id: collectionId },
        data: baseData,
        select: savedCollectionSelect,
      })
    : await db.$transaction(async (tx) => {
        await tx.collection.updateMany({
          data: {
            sortOrder: {
              increment: 1,
            },
          },
        });

        return tx.collection.create({
          data: {
            ...baseData,
            sortOrder: 1,
          },
          select: savedCollectionSelect,
        });
      });

  await writeAuditLog({
    action: collectionId ? "UPDATE" : "CREATE",
    entityType: "COLLECTION",
    entityId: savedCollection.id,
    before,
    after: savedCollection,
  });

  revalidateStorefront();
  return {
    success: collectionId ? "Collection updated." : "Collection created.",
    resetKey: collectionId ? undefined : Date.now(),
    collection: savedCollection,
  };
}

export async function autosaveCollectionDraftAction(
  formData: FormData,
): Promise<DraftAutosaveResult> {
  await requireAdminSession("/admin/collections");

  if (!hasMeaningfulDraftInput(formData, ["collectionId", "workflowState", "existingHeroImageUrl"])) {
    return {};
  }

  const parsed = parseFormData(formData, collectionFieldsSchema);
  if (!parsed.success) {
    return {};
  }
  const {
    collectionId, code, description, manifesto, searchSummary,
    symbolismLabel, symbolismTitle, symbolismBody, symbolismBody2,
  } = parsed.data;
  const slug = slugify(parsed.data.slug) || createDraftToken("draft-collection");
  const name = parsed.data.name || "Untitled collection";
  const removeHeroImage = parsed.data.removeHeroImage === "1";
  const existingHeroImageUrl = removeHeroImage ? "" : parsed.data.existingHeroImageUrl;

  const collectionData = {
    slug,
    code: code || null,
    name,
    description: description || null,
    manifesto: manifesto || null,
    searchSummary: searchSummary || null,
    symbolismLabel: symbolismLabel || null,
    symbolismTitle: symbolismTitle || null,
    symbolismBody: symbolismBody || null,
    symbolismBody2: symbolismBody2 || null,
    heroImageUrl: existingHeroImageUrl || null,
    status: "DRAFT" as const,
    visibility: "PRIVATE" as const,
    publishedAt: null,
  };

  const collection = collectionId
    ? await db.collection.update({
        where: { id: collectionId },
        data: collectionData,
        select: { id: true },
      })
    : await db.$transaction(async (tx) => {
        await tx.collection.updateMany({
          data: {
            sortOrder: {
              increment: 1,
            },
          },
        });

        return tx.collection.create({
          data: {
            ...collectionData,
            sortOrder: 1,
          },
          select: { id: true },
        });
      });

  await writeAuditLog({
    action: collectionId ? "AUTOSAVE_DRAFT_UPDATE" : "AUTOSAVE_DRAFT_CREATE",
    entityType: "COLLECTION",
    entityId: collection.id,
    after: collectionData,
  });

  revalidatePath("/admin/collections");
  revalidatePath("/admin");
  return { recordId: collection.id };
}

const deleteCollectionSchema = z.object({
  collectionId: z.string().trim().min(1),
  collectionSlug: z.string().trim().default(""),
});

export async function deleteCollectionAction(
  _prevState: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  await requireAdminSession("/admin/collections");

  const parsed = parseFormData(formData, deleteCollectionSchema);
  if (!parsed.success) {
    return { error: "Collection id is missing." };
  }
  const { collectionId, collectionSlug } = parsed.data;

  await db.$transaction(async (tx) => {
    await tx.collection.delete({
      where: { id: collectionId },
    });

    const remainingCollections = await tx.collection.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { name: "asc" }],
      select: { id: true },
    });

    await resequenceCollections(tx, remainingCollections);
  });

  revalidateStorefront();
  revalidatePath("/admin/collections");
  return {
    success: collectionSlug ? `Collection ${collectionSlug} deleted.` : "Collection deleted.",
    resetKey: Date.now(),
    deletedCollectionId: collectionId,
  };
}

const moveCollectionOrderSchema = z.object({
  collectionId: z.string().trim().min(1),
  direction: z.string().trim().default(""),
});

export async function moveCollectionOrderAction(
  _prevState: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  await requireAdminSession("/admin/collections");

  const parsed = parseFormData(formData, moveCollectionOrderSchema);
  if (!parsed.success) {
    return { error: "Collection id is missing." };
  }
  const { collectionId, direction } = parsed.data;

  if (direction !== "up" && direction !== "down") {
    return { error: "Unknown collection move direction." };
  }

  const before = await getSavedCollectionPayload(collectionId).catch(() => null);

  const collections = await db.$transaction(async (tx) => {
    const orderedCollections = await tx.collection.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { name: "asc" }],
      select: { id: true },
    });

    const currentIndex = orderedCollections.findIndex((collection) => collection.id === collectionId);
    if (currentIndex === -1) {
      throw new Error("Collection not found.");
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedCollections.length) {
      return listSavedCollections(tx);
    }

    const reorderedCollections = [...orderedCollections];
    const [movedCollection] = reorderedCollections.splice(currentIndex, 1);
    reorderedCollections.splice(targetIndex, 0, movedCollection);

    await resequenceCollections(tx, reorderedCollections);
    return listSavedCollections(tx);
  });

  const movedCollection = collections.find((collection) => collection.id === collectionId);

  await writeAuditLog({
    action: `REORDER_${direction.toUpperCase()}`,
    entityType: "COLLECTION",
    entityId: collectionId,
    before,
    after: movedCollection ?? null,
    metadata: { direction },
  });

  revalidateStorefront();
  revalidatePath("/admin/collections");
  return {
    success: direction === "up" ? "Collection moved up." : "Collection moved down.",
    collection: movedCollection,
    collections,
  };
}

const updateCollectionStatusSchema = z.object({
  collectionId: z.string().trim().min(1),
  action: z.string().trim().default(""),
});

export async function updateCollectionStatusAction(
  _prevState: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  await requireAdminSession("/admin/collections");

  const parsed = parseFormData(formData, updateCollectionStatusSchema);
  if (!parsed.success) {
    return { error: "Collection id is missing." };
  }
  const { collectionId, action } = parsed.data;

  const state =
    action === "publish"
      ? { status: "ACTIVE" as const, visibility: "PUBLIC" as const, publishedAt: new Date() }
      : action === "draft"
        ? { status: "DRAFT" as const, visibility: "PRIVATE" as const, publishedAt: null }
        : action === "archive"
          ? { status: "ARCHIVED" as const, visibility: "PRIVATE" as const, publishedAt: null }
          : null;

  if (!state) {
    return { error: "Unknown collection action." };
  }

  const before = await getSavedCollectionPayload(collectionId).catch(() => null);

  const collection = await db.collection.update({
    where: { id: collectionId },
    data: state,
    select: savedCollectionSelect,
  });

  await writeAuditLog({
    action: `STATUS_${action.toUpperCase()}`,
    entityType: "COLLECTION",
    entityId: collection.id,
    before,
    after: collection,
  });

  revalidateStorefront();
  revalidatePath("/admin/collections");
  return { success: `Collection moved to ${collection.status.toLowerCase()}.`, collection };
}
