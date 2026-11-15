import { escapeHtml } from "@/lib/content/rich-text";
import type { ProductReview, ProductReviewStatus } from "@prisma/client";

import { aggregatePublishedReviews } from "@/lib/reviews/aggregate";
import type { ProductReviewsData, PublicProductReview } from "@/lib/reviews/public";

type ReviewRow = Pick<
  ProductReview,
  | "id"
  | "rating"
  | "title"
  | "body"
  | "authorName"
  | "status"
  | "verifiedPurchase"
  | "createdAt"
>;

function toPublicReview(row: ReviewRow): PublicProductReview {
  return {
    id: row.id,
    rating: row.rating,
    title: escapeHtml(row.title),
    body: escapeHtml(row.body),
    authorDisplayName: escapeHtml(row.authorName),
    submittedAt: row.createdAt.toISOString(),
    verificationStatus: row.verifiedPurchase ? "verified_buyer" : "unverified",
    merchantReply: "",
    merchantRepliedAt: null,
  };
}

/** Map DB rows → storefront payload. Only PUBLISHED reviews are listed. */
export function toProductReviewsData(
  rows: Array<ReviewRow & { status: ProductReviewStatus }>,
): ProductReviewsData {
  const { average, count } = aggregatePublishedReviews(rows);
  const reviews = rows
    .filter((row) => row.status === "PUBLISHED")
    .map(toPublicReview);
  return { reviews, average, count };
}

/** Guard: ensure a value never carries authorEmail into public surfaces. */
export function assertNoAuthorEmail(value: unknown): void {
  if (value == null || typeof value !== "object") return;
  if ("authorEmail" in (value as object)) {
    throw new Error("authorEmail must never appear on storefront or JSON-LD payloads");
  }
  if (Array.isArray(value)) {
    for (const item of value) assertNoAuthorEmail(item);
    return;
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (nested && typeof nested === "object") assertNoAuthorEmail(nested);
  }
}
