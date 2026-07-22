"use server";

import { revalidatePath } from "next/cache";
import { ContentVisibility, PageStatus, PageTemplate, Prisma } from "@prisma/client";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { saveCollectionImageUpload, saveProductImageUpload } from "@/lib/media/local-upload";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTags(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => slugify(item))
        .filter(Boolean),
    ),
  );
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function uploadOptionalProductAsset(input: {
  formData: FormData;
  fieldName: string;
  existingValue: string;
  removeFieldName?: string;
  currentUserId?: string | null;
}) {
  const file = input.formData.get(input.fieldName);
  const shouldRemoveExisting = input.removeFieldName
    ? String(input.formData.get(input.removeFieldName) ?? "").trim() === "1"
    : false;

  if (!(file instanceof File) || file.size === 0) {
    return shouldRemoveExisting ? "" : input.existingValue.trim();
  }

  const uploaded = await saveProductImageUpload(file);
  if (!uploaded) {
    return input.existingValue.trim();
  }

  await db.mediaAsset.create({
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
      uploadedById: input.currentUserId ?? null,
    },
    select: { id: true },
  });

  return uploaded.publicPath;
}

function revalidateStorefront() {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/collections");
  revalidatePath("/collections/[slug]", "page");
  revalidatePath("/products/[slug]", "page");
  revalidatePath("/about");
  revalidatePath("/about/manifesto");
}

export type AdminAuditEntityType = "PRODUCT" | "COLLECTION" | "PAGE" | "CATEGORY" | "TAG";

export type AdminRecordHistoryItem = {
  id: string;
  action: string;
  createdAt: Date;
};

export type AdminRecordHistoryState = {
  error?: string;
  success?: string;
  history?: AdminRecordHistoryItem[];
};

function toAuditJson(value: unknown) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function snapshotString(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" ? value : "";
}

function snapshotNullableString(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" ? value : null;
}

function snapshotNumber(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function createDraftToken(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasMeaningfulDraftInput(formData: FormData, ignoredNames: string[] = []) {
  const ignored = new Set(ignoredNames);

  for (const [key, value] of formData.entries()) {
    if (ignored.has(key)) continue;

    if (value instanceof File) {
      if (value.size > 0) return true;
      continue;
    }

    if (String(value).trim()) return true;
  }

  return false;
}

async function writeAuditLog(input: {
  action: string;
  entityType: AdminAuditEntityType;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  actorId?: string | null;
}) {
  await db.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: toAuditJson(input.before),
      after: toAuditJson(input.after),
      metadata: toAuditJson(input.metadata),
      actorId: input.actorId ?? null,
    },
  });
}

const PROTECTED_PAGE_SLUGS = new Set(["home", "about", "manifesto"]);

export type CollectionActionState = {
  error?: string;
  success?: string;
  resetKey?: number;
  fieldErrors?: Partial<Record<CollectionFieldName, string>>;
  collection?: SavedCollectionPayload;
  collections?: SavedCollectionPayload[];
  deletedCollectionId?: string;
};

export type DraftAutosaveResult = {
  recordId?: string;
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

export type PageActionState = {
  error?: string;
  success?: string;
  page?: SavedPagePayload;
  deletedSlug?: string;
};

export type SavedPagePayload = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  title: string;
  excerpt: string | null;
  content: unknown;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
};

export type ProductActionState = {
  error?: string;
  success?: string;
  product?: SavedProductPayload;
  deletedProductId?: string;
  created?: boolean;
};

export type SavedProductPayload = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  sku: string;
  name: string;
  seriesLabel: string | null;
  shortDescription: string | null;
  description: string | null;
  materialLine: string | null;
  symbolismLabel: string | null;
  symbolismTitle: string | null;
  symbolismBody: string | null;
  symbolismBody2: string | null;
  details: unknown;
  imageUrl: string | null;
  priceCents: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  category: { id: string; slug: string; name: string } | null;
  collections: {
    id: string;
    sortOrder: number;
    collection: {
      id: string;
      slug: string;
      name: string;
    };
  }[];
  tags: {
    id: string;
    tag: { id: string; slug: string; name: string };
  }[];
};

export type CategoryActionState = {
  error?: string;
  success?: string;
  category?: SavedCategoryPayload;
  deletedCategoryId?: string;
  affectedProducts?: number;
};

export type SavedCategoryPayload = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

export type TagActionState = {
  error?: string;
  success?: string;
  tag?: SavedTagPayload;
  deletedTagId?: string;
  affectedProducts?: number;
};

export type SavedTagPayload = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  name: string;
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

async function getSavedProductPayload(productId: string): Promise<SavedProductPayload> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      sku: true,
      name: true,
      seriesLabel: true,
      shortDescription: true,
      description: true,
      materialLine: true,
      symbolismLabel: true,
      symbolismTitle: true,
      symbolismBody: true,
      symbolismBody2: true,
      details: true,
      imageUrl: true,
      priceCents: true,
      status: true,
      visibility: true,
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      collections: {
        include: {
          collection: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  return product;
}

async function getSavedCollectionPayload(collectionId: string): Promise<SavedCollectionPayload> {
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: savedCollectionSelect,
  });

  if (!collection) {
    throw new Error("Collection not found.");
  }

  return collection;
}

async function getSavedPagePayload(pageIdOrSlug: string): Promise<SavedPagePayload> {
  const page = await db.page.findFirst({
    where: { OR: [{ id: pageIdOrSlug }, { slug: pageIdOrSlug }] },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      status: true,
      visibility: true,
    },
  });

  if (!page) {
    throw new Error("Page not found.");
  }

  return page;
}

async function getSavedCategoryPayload(categoryId: string): Promise<SavedCategoryPayload> {
  const category = await db.productCategory.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      name: true,
      description: true,
      sortOrder: true,
    },
  });

  if (!category) {
    throw new Error("Category not found.");
  }

  return category;
}

async function getSavedTagPayload(tagId: string): Promise<SavedTagPayload> {
  const tag = await db.tag.findUnique({
    where: { id: tagId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      name: true,
    },
  });

  if (!tag) {
    throw new Error("Tag not found.");
  }

  return tag;
}

async function getCurrentRecordSnapshot(entityType: AdminAuditEntityType, entityId: string) {
  if (entityType === "PRODUCT") return getSavedProductPayload(entityId);
  if (entityType === "COLLECTION") return getSavedCollectionPayload(entityId);
  if (entityType === "PAGE") return getSavedPagePayload(entityId);
  if (entityType === "CATEGORY") return getSavedCategoryPayload(entityId);
  return getSavedTagPayload(entityId);
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

export async function savePageAction(formData: FormData): Promise<PageActionState> {
  const currentUser = await requireAdminSession("/admin/pages");

  const pageId = String(formData.get("pageId") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const workflowState = String(formData.get("workflowState") ?? "PUBLISHED");
  const title = String(formData.get("title") ?? "").trim();
  const slug = slugify(rawSlug || title);
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const eyebrow = String(formData.get("eyebrow") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
  const ctaHref = String(formData.get("ctaHref") ?? "").trim();
  const quote = String(formData.get("quote") ?? "").trim();
  const secondaryTitle = String(formData.get("secondaryTitle") ?? "").trim();
  const secondaryBody = String(formData.get("secondaryBody") ?? "").trim();

  if (!slug || !title) {
    return { error: "Page slug and title are required." };
  }

  const isPublished = workflowState === "PUBLISHED";
  const before = await getSavedPagePayload(pageId || slug).catch(() => null);
  const pageData = {
    slug,
    title,
    excerpt,
    content: {
      eyebrow,
      body,
      ctaLabel,
      ctaHref,
      quote,
      secondaryTitle,
      secondaryBody,
    },
    status: isPublished ? PageStatus.PUBLISHED : PageStatus.DRAFT,
    visibility: isPublished ? ContentVisibility.PUBLIC : ContentVisibility.PRIVATE,
    publishedAt: isPublished ? new Date() : null,
    authoredById: currentUser?.id ?? null,
  };

  const page = pageId
    ? await db.page.update({
        where: { id: pageId },
        data: pageData,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          slug: true,
          title: true,
          excerpt: true,
          content: true,
          status: true,
          visibility: true,
        },
      })
    : await (async () => {
        const existing = await db.page.findUnique({
          where: { slug },
          select: { template: true },
        });

        return db.page.upsert({
          where: { slug },
          update: pageData,
          create: {
            ...pageData,
            template: existing?.template ?? PageTemplate.STATIC_PAGE,
            searchSummary: excerpt || title,
          },
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            slug: true,
            title: true,
            excerpt: true,
            content: true,
            status: true,
            visibility: true,
          },
        });
      })();

  await writeAuditLog({
    action: before ? "UPDATE" : "CREATE",
    entityType: "PAGE",
    entityId: page.id,
    before,
    after: page,
    actorId: currentUser?.id,
  });

  revalidateStorefront();
  revalidatePath(`/${slug}`);
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages?updated=${slug}`);
  return { success: before ? "Page updated." : "Page created.", page };
}

export async function autosavePageDraftAction(formData: FormData): Promise<DraftAutosaveResult> {
  const currentUser = await requireAdminSession("/admin/pages");

  if (!hasMeaningfulDraftInput(formData, ["pageId", "workflowState"])) {
    return {};
  }

  const pageId = String(formData.get("pageId") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const eyebrow = String(formData.get("eyebrow") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
  const ctaHref = String(formData.get("ctaHref") ?? "").trim();
  const quote = String(formData.get("quote") ?? "").trim();
  const secondaryTitle = String(formData.get("secondaryTitle") ?? "").trim();
  const secondaryBody = String(formData.get("secondaryBody") ?? "").trim();
  const slug = slugify(rawSlug || title) || createDraftToken("draft-page");

  const pageData = {
    slug,
    title: title || "Untitled page",
    excerpt: excerpt || null,
    searchSummary: excerpt || title || "Untitled page",
    content: {
      eyebrow,
      body,
      ctaLabel,
      ctaHref,
      quote,
      secondaryTitle,
      secondaryBody,
    },
    status: "DRAFT" as const,
    visibility: "PRIVATE" as const,
    publishedAt: null,
    authoredById: currentUser?.id ?? null,
  };

  const page = pageId
    ? await db.page.update({
        where: { id: pageId },
        data: pageData,
        select: { id: true },
      })
    : await db.page.create({
        data: {
          ...pageData,
          template: "STATIC_PAGE",
        },
        select: { id: true },
      });

  revalidatePath("/admin/pages");
  revalidatePath("/admin");
  return { recordId: page.id };
}

export async function updatePageStatusAction(formData: FormData): Promise<PageActionState> {
  const currentUser = await requireAdminSession("/admin/pages");

  const slug = String(formData.get("slug") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  if (!slug) {
    return { error: "Page slug is missing." };
  }

  const state =
    action === "publish"
      ? { status: "PUBLISHED" as const, visibility: "PUBLIC" as const, publishedAt: new Date() }
      : action === "draft"
        ? { status: "DRAFT" as const, visibility: "PRIVATE" as const, publishedAt: null }
        : action === "archive"
          ? { status: "ARCHIVED" as const, visibility: "PRIVATE" as const, publishedAt: null }
          : null;

  if (!state) {
    return { error: "Unknown page action." };
  }

  const before = await getSavedPagePayload(slug).catch(() => null);

  const page = await db.page.update({
    where: { slug },
    data: state,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      status: true,
      visibility: true,
    },
  });

  await writeAuditLog({
    action: `STATUS_${action.toUpperCase()}`,
    entityType: "PAGE",
    entityId: page.id,
    before,
    after: page,
    actorId: currentUser?.id,
  });

  revalidateStorefront();
  revalidatePath("/admin/pages");
  return { success: `Page moved to ${page.status.toLowerCase()}.`, page };
}

export async function deletePageAction(formData: FormData): Promise<PageActionState> {
  const currentUser = await requireAdminSession("/admin/pages");

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();

  if (!slug) {
    return { error: "Page slug is required." };
  }

  if (PROTECTED_PAGE_SLUGS.has(slug)) {
    return { error: "System pages cannot be deleted." };
  }

  const before = await getSavedPagePayload(slug).catch(() => null);
  const page = await db.page.delete({
    where: { slug },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      status: true,
      visibility: true,
    },
  });

  await writeAuditLog({
    action: "DELETE",
    entityType: "PAGE",
    entityId: page.id,
    before,
    actorId: currentUser?.id,
  });

  revalidateStorefront();
  revalidatePath(`/${slug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/pages");

  return { success: "Page deleted.", deletedSlug: slug };
}

export async function saveCategoryAction(formData: FormData): Promise<CategoryActionState> {
  const currentUser = await requireAdminSession("/admin/products");

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Category name is required." };
  }

  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = Number(String(formData.get("sortOrder") ?? "0").trim() || "0");
  const before = categoryId ? await getSavedCategoryPayload(categoryId).catch(() => null) : null;

  const category = await db.productCategory.upsert({
    where: categoryId ? { id: categoryId } : { slug },
    update: {
      slug,
      name,
      description,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
    create: {
      slug,
      name,
      description,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      name: true,
      description: true,
      sortOrder: true,
    },
  });

  await writeAuditLog({
    action: categoryId ? "UPDATE" : "CREATE",
    entityType: "CATEGORY",
    entityId: category.id,
    before,
    after: category,
    actorId: currentUser?.id,
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  return { success: categoryId ? "Category updated." : "Category created.", category };
}

export async function deleteCategoryAction(formData: FormData): Promise<CategoryActionState> {
  await requireAdminSession("/admin/products");

  const categoryId = String(formData.get("categoryId") ?? "").trim();

  if (!categoryId) {
    return { error: "Category id is missing." };
  }

  const affectedProducts = await db.product.count({ where: { categoryId } });

  await db.productCategory.delete({
    where: { id: categoryId },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  return {
    success: "Category deleted. Products that used it now have no category.",
    deletedCategoryId: categoryId,
    affectedProducts,
  };
}

export async function saveTagAction(formData: FormData): Promise<TagActionState> {
  const currentUser = await requireAdminSession("/admin/products");

  const tagId = String(formData.get("tagId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Tag name is required." };
  }

  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const before = tagId ? await getSavedTagPayload(tagId).catch(() => null) : null;

  const tag = await db.tag.upsert({
    where: tagId ? { id: tagId } : { slug },
    update: {
      slug,
      name,
    },
    create: {
      slug,
      name,
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      name: true,
    },
  });

  await writeAuditLog({
    action: tagId ? "UPDATE" : "CREATE",
    entityType: "TAG",
    entityId: tag.id,
    before,
    after: tag,
    actorId: currentUser?.id,
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath("/admin/tags");
  return { success: tagId ? "Tag updated." : "Tag created.", tag };
}

export async function deleteTagAction(formData: FormData): Promise<TagActionState> {
  await requireAdminSession("/admin/products");

  const tagId = String(formData.get("tagId") ?? "").trim();

  if (!tagId) {
    return { error: "Tag id is missing." };
  }

  const affectedProducts = await db.productTag.count({ where: { tagId } });

  await db.tag.delete({
    where: { id: tagId },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath("/admin/tags");
  return {
    success: "Tag deleted and removed from products.",
    deletedTagId: tagId,
    affectedProducts,
  };
}

export async function saveCollectionAction(
  _prevState: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  const currentUser = await requireAdminSession("/admin/collections");

  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim());
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const manifesto = String(formData.get("manifesto") ?? "").trim();
  const searchSummary = String(formData.get("searchSummary") ?? "").trim();
  const symbolismLabel = String(formData.get("symbolismLabel") ?? "").trim();
  const symbolismTitle = String(formData.get("symbolismTitle") ?? "").trim();
  const symbolismBody = String(formData.get("symbolismBody") ?? "").trim();
  const symbolismBody2 = String(formData.get("symbolismBody2") ?? "").trim();
  const removeHeroImage = String(formData.get("removeHeroImage") ?? "").trim() === "1";
  const existingHeroImageUrl = removeHeroImage
    ? ""
    : String(formData.get("existingHeroImageUrl") ?? "").trim();
  const workflowState = String(formData.get("workflowState") ?? "DRAFT").trim();
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
            uploadedById: currentUser?.id ?? null,
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
    actorId: currentUser?.id,
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
  const currentUser = await requireAdminSession("/admin/collections");

  if (!hasMeaningfulDraftInput(formData, ["collectionId", "workflowState", "existingHeroImageUrl"])) {
    return {};
  }

  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim()) || createDraftToken("draft-collection");
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim() || "Untitled collection";
  const description = String(formData.get("description") ?? "").trim();
  const manifesto = String(formData.get("manifesto") ?? "").trim();
  const searchSummary = String(formData.get("searchSummary") ?? "").trim();
  const symbolismLabel = String(formData.get("symbolismLabel") ?? "").trim();
  const symbolismTitle = String(formData.get("symbolismTitle") ?? "").trim();
  const symbolismBody = String(formData.get("symbolismBody") ?? "").trim();
  const symbolismBody2 = String(formData.get("symbolismBody2") ?? "").trim();
  const removeHeroImage = String(formData.get("removeHeroImage") ?? "").trim() === "1";
  const existingHeroImageUrl = removeHeroImage
    ? ""
    : String(formData.get("existingHeroImageUrl") ?? "").trim();

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
    actorId: currentUser?.id,
  });

  revalidatePath("/admin/collections");
  revalidatePath("/admin");
  return { recordId: collection.id };
}

export async function deleteCollectionAction(
  _prevState: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  await requireAdminSession("/admin/collections");

  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const collectionSlug = String(formData.get("collectionSlug") ?? "").trim();

  if (!collectionId) {
    return { error: "Collection id is missing." };
  }

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

export async function moveCollectionOrderAction(
  _prevState: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  const currentUser = await requireAdminSession("/admin/collections");

  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();

  if (!collectionId) {
    return { error: "Collection id is missing." };
  }

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
    actorId: currentUser?.id,
  });

  revalidateStorefront();
  revalidatePath("/admin/collections");
  return {
    success: direction === "up" ? "Collection moved up." : "Collection moved down.",
    collection: movedCollection,
    collections,
  };
}

export async function updateCollectionStatusAction(
  _prevState: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  const currentUser = await requireAdminSession("/admin/collections");

  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  if (!collectionId) {
    return { error: "Collection id is missing." };
  }

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
    actorId: currentUser?.id,
  });

  revalidateStorefront();
  revalidatePath("/admin/collections");
  return { success: `Collection moved to ${collection.status.toLowerCase()}.`, collection };
}

export async function saveProductAction(formData: FormData): Promise<ProductActionState> {
  const currentUser = await requireAdminSession("/admin/products");

  const productId = String(formData.get("productId") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? ""));
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const seriesLabel = String(formData.get("seriesLabel") ?? "").trim();
  const shortDescription = String(formData.get("shortDescription") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const materialLine = String(formData.get("materialLine") ?? "").trim();
  const symbolismLabel = String(formData.get("symbolismLabel") ?? "").trim();
  const symbolismTitle = String(formData.get("symbolismTitle") ?? "").trim();
  const symbolismBody = String(formData.get("symbolismBody") ?? "").trim();
  const symbolismBody2 = String(formData.get("symbolismBody2") ?? "").trim();
  const removeImage = String(formData.get("removeImage") ?? "").trim() === "1";
  const existingImageUrl = removeImage
    ? ""
    : String(formData.get("existingImageUrl") ?? "").trim();
  const price = Number(String(formData.get("price") ?? "0").trim() || "0");
  const categorySlug = String(formData.get("categorySlug") ?? "").trim();
  const collectionSlug = String(formData.get("collectionSlug") ?? "").trim();
  const tagInput = String(formData.get("tags") ?? "").trim();
  const workflowState = String(formData.get("workflowState") ?? "DRAFT").trim();
  const imageFile = formData.get("imageFile");

  let imageUrl = existingImageUrl || null;
  let uploadedAssetId: string | null = null;

  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await saveProductImageUpload(imageFile);
    if (uploaded) {
      imageUrl = uploaded.publicPath;
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
          uploadedById: currentUser?.id ?? null,
        },
        select: { id: true },
      });
      uploadedAssetId = asset.id;
    }
  }

  const materialEntries = await Promise.all(
    [1, 2, 3].map(async (index) => {
      const image = await uploadOptionalProductAsset({
        formData,
        fieldName: `materialImageFile${index}`,
        existingValue: formValue(formData, `existingMaterialImage${index}`),
        removeFieldName: `removeMaterialImage${index}`,
        currentUserId: currentUser?.id,
      });

      return {
        title: formValue(formData, `materialTitle${index}`),
        body: formValue(formData, `materialBody${index}`),
        image,
      };
    }),
  );

  const processMediaImage = await uploadOptionalProductAsset({
    formData,
    fieldName: "processMediaImageFile",
    existingValue: formValue(formData, "existingProcessMediaImage"),
    removeFieldName: "removeProcessMediaImage",
    currentUserId: currentUser?.id,
  });

  const processStats = [1, 2, 3, 4]
    .map((index) => ({
      value: formValue(formData, `processStatValue${index}`),
      label: formValue(formData, `processStatLabel${index}`),
    }))
    .filter((item) => item.value && item.label);

  const lookbookEntries = await Promise.all(
    [1, 2, 3, 4].map(async (index) => {
      const src = await uploadOptionalProductAsset({
        formData,
        fieldName: `lookbookImageFile${index}`,
        existingValue: formValue(formData, `existingLookbookImage${index}`),
        removeFieldName: `removeLookbookImage${index}`,
        currentUserId: currentUser?.id,
      });

      return {
        src,
        label: formValue(formData, `lookbookLabel${index}`),
        featured: String(formData.get(`lookbookFeatured${index}`) ?? "") === "on",
      };
    }),
  );

  const details = {
    materials: materialEntries.filter((item) => item.title && item.body && item.image),
    process: {
      eyebrow: formValue(formData, "processEyebrow"),
      title: formValue(formData, "processTitle"),
      mediaImage: processMediaImage,
      stats: processStats,
    },
    lookbook: lookbookEntries.filter((item) => item.src),
  };

  if (!slug || !sku || !name || !price) {
    return {
      error: "Name, slug, SKU, and price are required.",
    };
  }

  const category = categorySlug
    ? await db.productCategory.findUnique({ where: { slug: categorySlug }, select: { id: true } })
    : null;
  const collection = collectionSlug
    ? await db.collection.findUnique({ where: { slug: collectionSlug }, select: { id: true } })
    : null;

  const isPublished = workflowState === "PUBLISHED";

  const wasCreate = !productId;
  const before = productId ? await getSavedProductPayload(productId).catch(() => null) : null;

  const product = await db.product.upsert({
    where: productId ? { id: productId } : { slug },
    update: {
      slug,
      sku,
      name,
      seriesLabel,
      shortDescription,
      description,
      materialLine,
      symbolismLabel: symbolismLabel || null,
      symbolismTitle: symbolismTitle || null,
      symbolismBody: symbolismBody || null,
      symbolismBody2: symbolismBody2 || null,
      details,
      imageUrl,
      ...(uploadedAssetId ? { primaryAssetId: uploadedAssetId } : {}),
      priceCents: Math.round(price * 100),
      categoryId: category?.id ?? null,
      status: isPublished ? "ACTIVE" : "DRAFT",
      visibility: isPublished ? "PUBLIC" : "PRIVATE",
      publishedAt: isPublished ? new Date() : null,
    },
    create: {
      slug,
      sku,
      name,
      seriesLabel,
      shortDescription,
      description,
      materialLine,
      symbolismLabel: symbolismLabel || null,
      symbolismTitle: symbolismTitle || null,
      symbolismBody: symbolismBody || null,
      symbolismBody2: symbolismBody2 || null,
      details,
      imageUrl,
      ...(uploadedAssetId ? { primaryAssetId: uploadedAssetId } : {}),
      priceCents: Math.round(price * 100),
      currency: "EUR",
      categoryId: category?.id ?? null,
      status: isPublished ? "ACTIVE" : "DRAFT",
      visibility: isPublished ? "PUBLIC" : "PRIVATE",
      publishedAt: isPublished ? new Date() : null,
    },
    select: { id: true, slug: true },
  });

  await db.productCollection.deleteMany({
    where: { productId: product.id },
  });

  if (collection) {
    await db.productCollection.create({
      data: {
        productId: product.id,
        collectionId: collection.id,
      },
    });
  }

  await db.productTag.deleteMany({
    where: { productId: product.id },
  });

  for (const tagSlug of parseTags(tagInput)) {
    const tag = await db.tag.upsert({
      where: { slug: tagSlug },
      update: { name: tagSlug.replace(/-/g, " ") },
      create: { slug: tagSlug, name: tagSlug.replace(/-/g, " ") },
      select: { id: true },
    });

    await db.productTag.create({
      data: {
        productId: product.id,
        tagId: tag.id,
      },
    });
  }

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath(`/products/${product.slug}`);

  const savedProduct = await getSavedProductPayload(product.id);

  await writeAuditLog({
    action: wasCreate ? "CREATE" : "UPDATE",
    entityType: "PRODUCT",
    entityId: savedProduct.id,
    before,
    after: savedProduct,
    actorId: currentUser?.id,
  });

  return {
    success: wasCreate ? "Product created." : "Product updated.",
    created: wasCreate,
    product: savedProduct,
  };
}

export async function autosaveProductDraftAction(formData: FormData): Promise<DraftAutosaveResult> {
  await requireAdminSession("/admin/products");

  if (!hasMeaningfulDraftInput(formData, ["productId", "workflowState", "existingImageUrl"])) {
    return {};
  }

  const productId = String(formData.get("productId") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim()) || createDraftToken("draft-product");
  const sku = String(formData.get("sku") ?? "").trim() || createDraftToken("sku").toUpperCase();
  const name = String(formData.get("name") ?? "").trim() || "Untitled product";
  const seriesLabel = String(formData.get("seriesLabel") ?? "").trim();
  const shortDescription = String(formData.get("shortDescription") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const materialLine = String(formData.get("materialLine") ?? "").trim();
  const price = Number(String(formData.get("price") ?? "0").trim() || "0");
  const removeImage = String(formData.get("removeImage") ?? "").trim() === "1";
  const existingImageUrl = removeImage
    ? ""
    : String(formData.get("existingImageUrl") ?? "").trim();

  const productData = {
    slug,
    sku,
    name,
    seriesLabel: seriesLabel || null,
    shortDescription: shortDescription || null,
    description: description || null,
    materialLine: materialLine || null,
    details: {},
    imageUrl: existingImageUrl || null,
    priceCents: Number.isFinite(price) ? Math.round(price * 100) : 0,
    status: "DRAFT" as const,
    visibility: "PRIVATE" as const,
    publishedAt: null,
  };

  const product = productId
    ? await db.product.update({
        where: { id: productId },
        data: productData,
        select: { id: true },
      })
    : await db.product.create({
        data: productData,
        select: { id: true },
      });

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  return { recordId: product.id };
}

export async function deleteProductAction(formData: FormData): Promise<ProductActionState> {
  await requireAdminSession("/admin/products");

  const productId = String(formData.get("productId") ?? "").trim();
  const productSlug = String(formData.get("productSlug") ?? "").trim();

  if (!productId) {
    return {
      error: "Product id is missing.",
    };
  }

  await db.product.delete({
    where: { id: productId },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");

  if (productSlug) {
    revalidatePath(`/products/${productSlug}`);
  }

  return {
    success: "Product deleted.",
    deletedProductId: productId,
  };
}

export async function updateProductStatusAction(formData: FormData): Promise<ProductActionState> {
  const currentUser = await requireAdminSession("/admin/products");

  const productId = String(formData.get("productId") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  if (!productId) {
    return { error: "Product id is missing." };
  }

  const state =
    action === "publish"
      ? { status: "ACTIVE" as const, visibility: "PUBLIC" as const, publishedAt: new Date() }
      : action === "draft"
        ? { status: "DRAFT" as const, visibility: "PRIVATE" as const, publishedAt: null }
        : action === "archive"
          ? { status: "ARCHIVED" as const, visibility: "PRIVATE" as const, publishedAt: null }
          : null;

  if (!state) {
    return { error: "Unknown product action." };
  }

  const before = await getSavedProductPayload(productId).catch(() => null);

  const product = await db.product.update({
    where: { id: productId },
    data: state,
    select: { id: true, slug: true, status: true },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath(`/products/${product.slug}`);

  const savedProduct = await getSavedProductPayload(product.id);

  await writeAuditLog({
    action: `STATUS_${action.toUpperCase()}`,
    entityType: "PRODUCT",
    entityId: savedProduct.id,
    before,
    after: savedProduct,
    actorId: currentUser?.id,
  });

  return {
    success: `Product moved to ${product.status.toLowerCase()}.`,
    product: savedProduct,
  };
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
  const currentUser = await requireAdminSession("/admin");

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
      revalidatePath(`/products/${snapshotString(snapshot, "slug")}`);
    }

    const after = await getCurrentRecordSnapshot(input.entityType, input.entityId);
    await writeAuditLog({
      action: "RESTORE",
      entityType: input.entityType,
      entityId: input.entityId,
      before,
      after,
      metadata: { restoredFromAuditLogId: input.auditLogId },
      actorId: currentUser?.id,
    });

    revalidateStorefront();
    return { success: "Version restored. The table has been refreshed." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Version restore failed.",
    };
  }
}
