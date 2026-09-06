"use server";

import { revalidatePath } from "next/cache";
import { ContentVisibility, PageStatus, PageTemplate } from "@prisma/client";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { slugify } from "@/lib/text/slug";
import { savePageImageUpload } from "@/lib/media/local-upload";
import {
  asRecord,
  createDraftToken,
  hasMeaningfulDraftInput,
  revalidateStorefront,
  writeAuditLog,
  type DraftAutosaveResult,
} from "./shared";

const PROTECTED_PAGE_SLUGS = new Set(["home", "about", "manifesto"]);

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

export async function getSavedPagePayload(pageIdOrSlug: string): Promise<SavedPagePayload> {
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

async function uploadOptionalPageAsset(input: {
  formData: FormData;
  fieldName: string;
  existingValue: string;
  removeFieldName?: string;
  pageSlug: string;
  uploadedByUsername?: string | null;
}) {
  const file = input.formData.get(input.fieldName);
  const shouldRemoveExisting = input.removeFieldName
    ? String(input.formData.get(input.removeFieldName) ?? "").trim() === "1"
    : false;

  if (!(file instanceof File) || file.size === 0) {
    return shouldRemoveExisting ? "" : input.existingValue.trim();
  }

  const uploaded = await savePageImageUpload(file, input.pageSlug);
  if (!uploaded) return input.existingValue.trim();

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
      uploadedByUsername: input.uploadedByUsername ?? null,
    },
    select: { id: true },
  });

  return uploaded.publicPath;
}

const pageContentFieldsSchema = z.object({
  pageId: z.string().trim().default(""),
  slug: z.string().trim().default(""),
  title: z.string().trim().default(""),
  excerpt: z.string().trim().default(""),
  eyebrow: z.string().trim().default(""),
  body: z.string().trim().default(""),
  ctaLabel: z.string().trim().default(""),
  ctaHref: z.string().trim().default(""),
  quote: z.string().trim().default(""),
  secondaryTitle: z.string().trim().default(""),
  secondaryBody: z.string().trim().default(""),
  ptTitle: z.string().trim().default(""),
  ptExcerpt: z.string().trim().default(""),
  ptEyebrow: z.string().trim().default(""),
  ptBody: z.string().trim().default(""),
  ptCtaLabel: z.string().trim().default(""),
  ptQuote: z.string().trim().default(""),
  ptSecondaryTitle: z.string().trim().default(""),
  ptSecondaryBody: z.string().trim().default(""),
});

const savePageSchema = pageContentFieldsSchema.extend({
  title: z.string().trim().min(1),
  workflowState: z.string().trim().default("PUBLISHED"),
});

export async function savePageAction(formData: FormData): Promise<PageActionState> {
  const currentUser = await requireAdminSession("/admin/pages");

  const parsed = parseFormData(formData, savePageSchema);
  if (!parsed.success) {
    return { error: "Page slug and title are required." };
  }
  const {
    pageId, workflowState, title, excerpt, eyebrow, body, ctaLabel, ctaHref, quote,
    secondaryTitle, secondaryBody, ptTitle, ptExcerpt, ptEyebrow, ptBody, ptCtaLabel,
    ptQuote, ptSecondaryTitle, ptSecondaryBody,
  } = parsed.data;
  const slug = slugify(parsed.data.slug || title);

  if (!slug || !title) {
    return { error: "Page slug and title are required." };
  }

  const isPublished = workflowState === "PUBLISHED";
  const before = await getSavedPagePayload(pageId || slug).catch(() => null);
  const existingContent = asRecord(before?.content);
  const heroImage = await uploadOptionalPageAsset({
    formData,
    fieldName: "heroImageFile",
    existingValue: typeof existingContent.heroImage === "string" ? existingContent.heroImage : "",
    removeFieldName: "removeHeroImage",
    pageSlug: slug,
    uploadedByUsername: currentUser?.username,
  });
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
      heroImage,
      translations: {
        pt: {
          title: ptTitle,
          excerpt: ptExcerpt,
          eyebrow: ptEyebrow,
          body: ptBody,
          ctaLabel: ptCtaLabel,
          ctaHref,
          quote: ptQuote,
          secondaryTitle: ptSecondaryTitle,
          secondaryBody: ptSecondaryBody,
        },
      },
    },
    status: isPublished ? PageStatus.PUBLISHED : PageStatus.DRAFT,
    visibility: isPublished ? ContentVisibility.PUBLIC : ContentVisibility.PRIVATE,
    publishedAt: isPublished ? new Date() : null,
    authoredByUsername: currentUser?.username ?? null,
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
  });

  revalidateStorefront();
  revalidateStorefrontPath(`/${slug}`);
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages?updated=${slug}`);
  return { success: before ? "Page updated." : "Page created.", page };
}

export async function autosavePageDraftAction(formData: FormData): Promise<DraftAutosaveResult> {
  const currentUser = await requireAdminSession("/admin/pages");

  if (!hasMeaningfulDraftInput(formData, ["pageId", "workflowState"])) {
    return {};
  }

  const parsed = parseFormData(formData, pageContentFieldsSchema);
  if (!parsed.success) {
    return {};
  }
  const {
    pageId, title, excerpt, eyebrow, body, ctaLabel, ctaHref, quote,
    secondaryTitle, secondaryBody, ptTitle, ptExcerpt, ptEyebrow, ptBody, ptCtaLabel,
    ptQuote, ptSecondaryTitle, ptSecondaryBody,
  } = parsed.data;
  const slug = slugify(parsed.data.slug || title) || createDraftToken("draft-page");

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
      translations: {
        pt: {
          title: ptTitle,
          excerpt: ptExcerpt,
          eyebrow: ptEyebrow,
          body: ptBody,
          ctaLabel: ptCtaLabel,
          ctaHref,
          quote: ptQuote,
          secondaryTitle: ptSecondaryTitle,
          secondaryBody: ptSecondaryBody,
        },
      },
    },
    status: "DRAFT" as const,
    visibility: "PRIVATE" as const,
    publishedAt: null,
    authoredByUsername: currentUser?.username ?? null,
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

const updatePageStatusSchema = z.object({
  slug: z.string().trim().min(1),
  action: z.string().trim().default(""),
});

export async function updatePageStatusAction(formData: FormData): Promise<PageActionState> {
  await requireAdminSession("/admin/pages");

  const parsed = parseFormData(formData, updatePageStatusSchema);
  if (!parsed.success) {
    return { error: "Page slug is missing." };
  }
  const { slug, action } = parsed.data;

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
  });

  revalidateStorefront();
  revalidatePath("/admin/pages");
  return { success: `Page moved to ${page.status.toLowerCase()}.`, page };
}

const deletePageSchema = z.object({
  slug: z.string().trim().toLowerCase().min(1),
});

export async function deletePageAction(formData: FormData): Promise<PageActionState> {
  await requireAdminSession("/admin/pages");

  const parsed = parseFormData(formData, deletePageSchema);
  if (!parsed.success) {
    return { error: "Page slug is required." };
  }
  const { slug } = parsed.data;

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
  });

  revalidateStorefront();
  revalidateStorefrontPath(`/${slug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/pages");

  return { success: "Page deleted.", deletedSlug: slug };
}
