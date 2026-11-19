import "server-only";

import { Prisma, type ProductReviewStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { normalizeReviewEmail, publicAuthorName } from "@/lib/reviews/author";
import { getProductReviewsSettings } from "@/lib/reviews/settings";
import { toProductReviewsData } from "@/lib/reviews/map-public";
import type { ProductReviewsData } from "@/lib/reviews/public";

export type UpsertLocalReviewInput = {
  productId: string;
  locale: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  authorEmail: string;
};

export type UpsertLocalReviewOutcome = {
  reviews: ProductReviewsData;
  /**
   * Existing row for (productId, authorEmail) left untouched — email is not
   * verified on anonymous submit, so create-only. Caller returns neutral success.
   */
  blockedHidden: boolean;
  /** True when the write made a PUBLISHED review visible on the storefront. */
  storefrontChanged: boolean;
};

const publishedSelect = {
  id: true,
  rating: true,
  title: true,
  body: true,
  authorName: true,
  status: true,
  verifiedPurchase: true,
  createdAt: true,
} as const;

async function listPublishedReviews(productId: string): Promise<ProductReviewsData> {
  const rows = await db.productReview.findMany({
    where: { productId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: publishedSelect,
  });
  return toProductReviewsData(rows);
}

/**
 * Create-only by (productId, authorEmail).
 * - Moderation on (default): create → PENDING.
 * - Moderation off: create → PUBLISHED immediately.
 * - Any existing row (any status) is left untouched — anonymous email is unverified.
 */
export async function upsertLocalProductReview(
  input: UpsertLocalReviewInput,
): Promise<UpsertLocalReviewOutcome> {
  const settings = await getProductReviewsSettings();
  const authorEmail = normalizeReviewEmail(input.authorEmail);
  const authorName = publicAuthorName(input.authorName);

  const existing = await db.productReview.findUnique({
    where: {
      productId_authorEmail: {
        productId: input.productId,
        authorEmail,
      },
    },
    select: { status: true },
  });

  // Any prior row: write nothing. Same neutral path for HIDDEN / PENDING / PUBLISHED.
  if (existing) {
    return {
      reviews: await listPublishedReviews(input.productId),
      blockedHidden: true,
      storefrontChanged: false,
    };
  }

  const status: ProductReviewStatus = settings.moderationBeforePublish
    ? "PENDING"
    : "PUBLISHED";
  const now = new Date();

  try {
    await db.productReview.create({
      data: {
        productId: input.productId,
        locale: input.locale,
        rating: input.rating,
        title: input.title,
        body: input.body,
        authorName,
        authorEmail,
        status,
        verifiedPurchase: false,
        moderatedAt: status === "PUBLISHED" ? now : null,
        moderatedBy: status === "PUBLISHED" ? "auto" : null,
      },
    });
  } catch (error) {
    // Concurrent create on the same (productId, authorEmail) — treat as existing.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        reviews: await listPublishedReviews(input.productId),
        blockedHidden: true,
        storefrontChanged: false,
      };
    }
    throw error;
  }

  return {
    reviews: await listPublishedReviews(input.productId),
    blockedHidden: false,
    storefrontChanged: status === "PUBLISHED",
  };
}

export async function setProductReviewStatus(input: {
  ids: string[];
  status: ProductReviewStatus;
  moderatedBy: string;
}): Promise<number> {
  if (input.ids.length === 0) return 0;
  const result = await db.productReview.updateMany({
    where: { id: { in: input.ids } },
    data: {
      status: input.status,
      moderatedAt: new Date(),
      moderatedBy: input.moderatedBy,
    },
  });
  return result.count;
}
