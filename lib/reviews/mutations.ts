import "server-only";

import type { ProductReviewStatus } from "@prisma/client";

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
  /** Existing HIDDEN row left untouched — caller must return a neutral success. */
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
 * Upsert by (productId, authorEmail).
 * - Moderation on (default): create/update → PENDING.
 * - Moderation off: create/update → PUBLISHED immediately.
 * - HIDDEN rows are irreversible for the author: leave untouched.
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

  if (existing?.status === "HIDDEN") {
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

  await db.productReview.upsert({
    where: {
      productId_authorEmail: {
        productId: input.productId,
        authorEmail,
      },
    },
    create: {
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
    update: {
      locale: input.locale,
      rating: input.rating,
      title: input.title,
      body: input.body,
      authorName,
      status,
      moderatedAt: status === "PUBLISHED" ? now : null,
      moderatedBy: status === "PUBLISHED" ? "auto" : null,
    },
  });

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
