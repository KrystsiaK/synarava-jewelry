"use server";

import { revalidatePath } from "next/cache";
import { ContentLocale, ContentVisibility, PageStatus, TranslationReviewStatus } from "@prisma/client";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { revalidateStorefrontPath, revalidateStorefrontTemplate } from "@/lib/content/revalidate-storefront";
import { db } from "@/lib/db";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { savePageImageUpload } from "@/lib/media/local-upload";
import { validatePostPublication } from "@/lib/posts/localization";
import { getS3Bucket, getS3PublicUrl } from "@/lib/s3";
import { slugify } from "@/lib/text/slug";
import {
  createDraftToken,
  hasMeaningfulDraftInput,
  writeAuditLog,
  type DraftAutosaveResult,
} from "./shared";

export type SavedPostTranslationPayload = {
  id: string;
  locale: "EN" | "PT";
  title: string;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  reviewStatus: "DRAFT" | "REVIEWED";
  reviewedAt: string | null;
};

export type SavedPostPayload = {
  id: string;
  slug: string;
  coverAssetId: string | null;
  coverUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  publishedAt: string | null;
  authoredByUsername: string | null;
  createdAt: string;
  updatedAt: string;
  translations: SavedPostTranslationPayload[];
};

export type PostActionState = {
  error?: string;
  success?: string;
  post?: SavedPostPayload;
};

const postFieldsSchema = z.object({
  postId: z.string().trim().default(""),
  slug: z.string().trim().default(""),
  workflowState: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  enTitle: z.string().trim().default(""),
  enExcerpt: z.string().trim().default(""),
  enBody: z.string().trim().default(""),
  enSeoTitle: z.string().trim().default(""),
  enSeoDescription: z.string().trim().default(""),
  enReviewed: z.string().trim().default(""),
  ptTitle: z.string().trim().default(""),
  ptExcerpt: z.string().trim().default(""),
  ptBody: z.string().trim().default(""),
  ptSeoTitle: z.string().trim().default(""),
  ptSeoDescription: z.string().trim().default(""),
  ptReviewed: z.string().trim().default(""),
  removeCover: z.string().trim().default(""),
});

function nullable(value: string) {
  return value || null;
}

function serializePost(post: {
  id: string;
  slug: string;
  coverAssetId: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  publishedAt: Date | null;
  authoredByUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
  translations: Array<{
    id: string;
    locale: "EN" | "PT";
    title: string;
    excerpt: string | null;
    body: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    reviewStatus: "DRAFT" | "REVIEWED";
    reviewedAt: Date | null;
  }>;
  coverAsset?: { key: string } | null;
}): SavedPostPayload {
  return {
    ...post,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    coverUrl: post.coverAsset ? getS3PublicUrl(post.coverAsset.key) : null,
    translations: post.translations.map((translation) => ({
      ...translation,
      reviewedAt: translation.reviewedAt?.toISOString() ?? null,
    })),
  };
}

const postInclude = {
  translations: { orderBy: { locale: "asc" as const } },
  coverAsset: { select: { key: true } },
} as const;

export async function getAdminPosts(): Promise<SavedPostPayload[]> {
  const posts = await db.post.findMany({
    orderBy: { updatedAt: "desc" },
    include: postInclude,
  });
  return posts.map(serializePost);
}

export async function getSavedPostPayload(postId: string): Promise<SavedPostPayload> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: postInclude,
  });
  if (!post) throw new Error("Post not found.");
  return serializePost(post);
}

export async function savePostAction(formData: FormData): Promise<PostActionState> {
  const currentUser = await requireAdminSession("/admin/posts");
  const parsed = parseFormData(formData, postFieldsSchema);
  if (!parsed.success) return { error: "The post form is invalid." };

  const input = parsed.data;
  const slug = slugify(input.slug || input.enTitle || input.ptTitle);
  if (!slug) return { error: "Add a slug or an English title." };

  const before = input.postId
    ? await db.post.findUnique({ where: { id: input.postId }, include: postInclude })
    : null;
  const isPublished = input.workflowState === "PUBLISHED";
  const translations = [
    {
      locale: "EN" as const,
      title: input.enTitle,
      excerpt: input.enExcerpt,
      body: input.enBody,
      reviewStatus: input.enReviewed === "1" ? "REVIEWED" as const : "DRAFT" as const,
    },
    {
      locale: "PT" as const,
      title: input.ptTitle,
      excerpt: input.ptExcerpt,
      body: input.ptBody,
      reviewStatus: input.ptReviewed === "1" ? "REVIEWED" as const : "DRAFT" as const,
    },
  ];

  if (isPublished) {
    const blockers = validatePostPublication({
      translations,
    });
    if (blockers.length > 0) {
      return { error: `Cannot publish yet: ${blockers.join(", ")}.` };
    }
  }

  const now = new Date();
  let coverAssetId = input.removeCover === "1" ? null : before?.coverAssetId ?? null;
  const coverFile = formData.get("coverImageFile");
  if (coverFile instanceof File && coverFile.size > 0) {
    const uploaded = await savePageImageUpload(coverFile, `post-${slug}`);
    if (uploaded) {
      const asset = await db.mediaAsset.create({
        data: {
          key: uploaded.storageKey,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          extension: uploaded.extension.replace(/^\./, ""),
          sizeBytes: uploaded.sizeBytes,
          width: uploaded.width,
          height: uploaded.height,
          bucket: getS3Bucket(),
          source: "UPLOAD",
          status: "READY",
          uploadedByUsername: currentUser?.username ?? null,
        },
        select: { id: true },
      });
      coverAssetId = asset.id;
    }
  }
  const post = await db.$transaction(async (transaction) => {
    const saved = input.postId
      ? await transaction.post.update({
          where: { id: input.postId },
          data: {
            slug,
            coverAssetId,
            status: isPublished ? PageStatus.PUBLISHED : PageStatus.DRAFT,
            visibility: isPublished ? ContentVisibility.PUBLIC : ContentVisibility.PRIVATE,
            publishedAt: isPublished ? before?.publishedAt ?? now : null,
            authoredByUsername: currentUser?.username ?? before?.authoredByUsername ?? null,
          },
        })
      : await transaction.post.create({
          data: {
            slug,
            coverAssetId,
            status: isPublished ? PageStatus.PUBLISHED : PageStatus.DRAFT,
            visibility: isPublished ? ContentVisibility.PUBLIC : ContentVisibility.PRIVATE,
            publishedAt: isPublished ? now : null,
            authoredByUsername: currentUser?.username ?? null,
          },
        });

    const localeInputs = [
      {
        locale: ContentLocale.EN,
        title: input.enTitle,
        excerpt: input.enExcerpt,
        body: input.enBody,
        seoTitle: input.enSeoTitle,
        seoDescription: input.enSeoDescription,
        reviewed: input.enReviewed === "1",
      },
      {
        locale: ContentLocale.PT,
        title: input.ptTitle,
        excerpt: input.ptExcerpt,
        body: input.ptBody,
        seoTitle: input.ptSeoTitle,
        seoDescription: input.ptSeoDescription,
        reviewed: input.ptReviewed === "1",
      },
    ];

    for (const translation of localeInputs) {
      await transaction.postTranslation.upsert({
        where: { postId_locale: { postId: saved.id, locale: translation.locale } },
        update: {
          title: translation.title,
          excerpt: nullable(translation.excerpt),
          body: nullable(translation.body),
          seoTitle: nullable(translation.seoTitle),
          seoDescription: nullable(translation.seoDescription),
          reviewStatus: translation.reviewed ? TranslationReviewStatus.REVIEWED : TranslationReviewStatus.DRAFT,
          reviewedAt: translation.reviewed ? now : null,
        },
        create: {
          postId: saved.id,
          locale: translation.locale,
          title: translation.title,
          excerpt: nullable(translation.excerpt),
          body: nullable(translation.body),
          seoTitle: nullable(translation.seoTitle),
          seoDescription: nullable(translation.seoDescription),
          reviewStatus: translation.reviewed ? TranslationReviewStatus.REVIEWED : TranslationReviewStatus.DRAFT,
          reviewedAt: translation.reviewed ? now : null,
        },
      });
    }

    return transaction.post.findUniqueOrThrow({ where: { id: saved.id }, include: postInclude });
  });

  await writeAuditLog({
    action: before ? "UPDATE" : "CREATE",
    entityType: "POST",
    entityId: post.id,
    before,
    after: post,
  });

  revalidatePath("/admin/posts");
  revalidateStorefrontPath("/journal");
  revalidateStorefrontPath(`/journal/${slug}`);
  revalidateStorefrontTemplate("/journal/[slug]");
  if (before && before.slug !== slug) revalidateStorefrontPath(`/journal/${before.slug}`);

  return {
    success: before ? "Post updated." : "Post created.",
    post: serializePost(post),
  };
}

export async function autosavePostDraftAction(formData: FormData): Promise<DraftAutosaveResult> {
  const currentUser = await requireAdminSession("/admin/posts");
  if (!hasMeaningfulDraftInput(formData, ["postId", "workflowState", "removeCover"])) return {};

  const parsed = parseFormData(formData, postFieldsSchema);
  if (!parsed.success) return {};
  const input = parsed.data;
  const slug = slugify(input.slug || input.enTitle || input.ptTitle) || createDraftToken("draft-post");
  const now = new Date();
  if (input.postId) {
    const existing = await db.post.findUnique({ where: { id: input.postId }, select: { status: true } });
    if (existing?.status === "PUBLISHED") return { recordId: input.postId };
  }

  const post = await db.$transaction(async (transaction) => {
    const saved = input.postId
      ? await transaction.post.update({
          where: { id: input.postId },
          data: { slug, status: "DRAFT", visibility: "PRIVATE", publishedAt: null },
        })
      : await transaction.post.create({
          data: {
            slug,
            status: "DRAFT",
            visibility: "PRIVATE",
            authoredByUsername: currentUser?.username ?? null,
          },
        });

    for (const translation of [
      {
        locale: ContentLocale.EN,
        title: input.enTitle || "Untitled post",
        excerpt: input.enExcerpt,
        body: input.enBody,
        seoTitle: input.enSeoTitle,
        seoDescription: input.enSeoDescription,
        reviewed: input.enReviewed === "1",
      },
      {
        locale: ContentLocale.PT,
        title: input.ptTitle,
        excerpt: input.ptExcerpt,
        body: input.ptBody,
        seoTitle: input.ptSeoTitle,
        seoDescription: input.ptSeoDescription,
        reviewed: input.ptReviewed === "1",
      },
    ]) {
      await transaction.postTranslation.upsert({
        where: { postId_locale: { postId: saved.id, locale: translation.locale } },
        update: {
          title: translation.title,
          excerpt: nullable(translation.excerpt),
          body: nullable(translation.body),
          seoTitle: nullable(translation.seoTitle),
          seoDescription: nullable(translation.seoDescription),
          reviewStatus: translation.reviewed ? "REVIEWED" : "DRAFT",
          reviewedAt: translation.reviewed ? now : null,
        },
        create: {
          postId: saved.id,
          locale: translation.locale,
          title: translation.title,
          excerpt: nullable(translation.excerpt),
          body: nullable(translation.body),
          seoTitle: nullable(translation.seoTitle),
          seoDescription: nullable(translation.seoDescription),
          reviewStatus: translation.reviewed ? "REVIEWED" : "DRAFT",
          reviewedAt: translation.reviewed ? now : null,
        },
      });
    }

    return saved;
  });

  revalidatePath("/admin/posts");
  return { recordId: post.id };
}
