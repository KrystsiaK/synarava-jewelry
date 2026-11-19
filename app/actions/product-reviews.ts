"use server";

import { headers } from "next/headers";

import { checkRateLimit } from "@/lib/auth/rate-limit";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { db } from "@/lib/db";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { normalizeReviewEmail } from "@/lib/reviews/author";
import { upsertLocalProductReview } from "@/lib/reviews/mutations";
import type { PublicProductReview } from "@/lib/reviews/public";
import { productReviewSubmitSchema } from "@/lib/reviews/schema";
import { getProductReviewsSettings } from "@/lib/reviews/settings";
import { getTrustedClientIp } from "@/lib/security/request-ip";
import { isSynaravaProductAccessible } from "@/lib/shopify/reconciliation";

export type ProductReviewNotice =
  | "checkFields"
  | "productNotReady"
  | "rateLimited"
  | "publishFailed"
  | "pendingModeration"
  | "success";

export type ProductReviewField =
  | "rating"
  | "title"
  | "body"
  | "authorName"
  | "authorEmail";

export type ProductReviewActionState = {
  notice?: ProductReviewNotice;
  fieldErrors?: Partial<Record<ProductReviewField, ProductReviewField>>;
  average?: number | null;
  count?: number;
  reviews?: PublicProductReview[];
};

const REVIEW_RATE_WINDOW_MS = 24 * 60 * 60 * 1_000;
const REVIEW_IP_MAX = 5;
const REVIEW_EMAIL_MAX = 5;
const REVIEW_GLOBAL_WINDOW_MS = 60 * 60 * 1_000;
const REVIEW_GLOBAL_MAX = 30;

export async function submitProductReviewAction(
  _state: ProductReviewActionState,
  formData: FormData,
): Promise<ProductReviewActionState> {
  const parsed = parseFormData(formData, productReviewSubmitSchema);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      notice: "checkFields",
      fieldErrors: {
        rating: fields.rating?.[0] ? "rating" : undefined,
        title: fields.title?.[0] ? "title" : undefined,
        body: fields.body?.[0] ? "body" : undefined,
        authorName: fields.authorName?.[0] ? "authorName" : undefined,
        authorEmail: fields.authorEmail?.[0] ? "authorEmail" : undefined,
      },
    };
  }

  // Honeypot: soft-success without writing.
  if (parsed.data.company.trim()) {
    return { notice: "success", average: null, count: 0, reviews: [] };
  }

  const product = await db.product.findUnique({
    where: { slug: parsed.data.productSlug },
    select: { id: true, status: true, visibility: true },
  });
  if (!product || !isSynaravaProductAccessible(product.status, product.visibility)) {
    return { notice: "productNotReady" };
  }

  const headerList = await headers();
  const ip = getTrustedClientIp(headerList);
  const email = normalizeReviewEmail(parsed.data.authorEmail);

  // IP bucket (shared across emails) + per-email daily cap + shared flood cap.
  const ipLimit = await checkRateLimit("product-review-ip", ip, {
    max: REVIEW_IP_MAX,
    windowMs: REVIEW_RATE_WINDOW_MS,
  });
  if (!ipLimit.ok) return { notice: "rateLimited" };

  const emailLimit = await checkRateLimit("product-review-email", email, {
    max: REVIEW_EMAIL_MAX,
    windowMs: REVIEW_RATE_WINDOW_MS,
  });
  if (!emailLimit.ok) return { notice: "rateLimited" };

  const globalLimit = await checkRateLimit("product-review-global", "all", {
    max: REVIEW_GLOBAL_MAX,
    windowMs: REVIEW_GLOBAL_WINDOW_MS,
  });
  if (!globalLimit.ok) return { notice: "rateLimited" };

  try {
    const settings = await getProductReviewsSettings();
    const outcome = await upsertLocalProductReview({
      productId: product.id,
      locale: parsed.data.locale,
      rating: parsed.data.rating,
      title: parsed.data.title,
      body: parsed.data.body,
      authorName: parsed.data.authorName,
      authorEmail: parsed.data.authorEmail,
    });

    // Existing row (any status) — same neutral success as honeypot; never leak status.
    if (outcome.blockedHidden) {
      return {
        notice: "success",
        average: outcome.reviews.average,
        count: outcome.reviews.count,
        reviews: outcome.reviews.reviews,
      };
    }

    if (outcome.storefrontChanged) {
      revalidateStorefrontPath(`/products/${parsed.data.productSlug}`);
    }

    return {
      notice: settings.moderationBeforePublish ? "pendingModeration" : "success",
      average: outcome.reviews.average,
      count: outcome.reviews.count,
      reviews: outcome.reviews.reviews,
    };
  } catch (error) {
    console.error(
      "[product-reviews] submit failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return { notice: "publishFailed" };
  }
}
