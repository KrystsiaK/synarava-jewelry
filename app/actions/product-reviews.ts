"use server";

import { headers } from "next/headers";

import { checkRateLimit } from "@/lib/auth/rate-limit";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { db } from "@/lib/db";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { upsertLocalProductReview } from "@/lib/reviews/mutations";
import type { PublicProductReview } from "@/lib/reviews/public";
import { productReviewSubmitSchema } from "@/lib/reviews/schema";
import { getProductReviewsSettings } from "@/lib/reviews/settings";

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

function clientIpFromHeaders(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip")?.trim() || "unknown";
}

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
    select: { id: true },
  });
  if (!product) {
    return { notice: "productNotReady" };
  }

  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);
  const rateLimit = await checkRateLimit(
    "product-review",
    `${parsed.data.authorEmail.toLowerCase()}:${product.id}:${ip}`,
    { max: 5, windowMs: 24 * 60 * 60 * 1_000 },
  );
  if (!rateLimit.ok) return { notice: "rateLimited" };

  try {
    const settings = await getProductReviewsSettings();
    const reviews = await upsertLocalProductReview({
      productId: product.id,
      locale: parsed.data.locale,
      rating: parsed.data.rating,
      title: parsed.data.title,
      body: parsed.data.body,
      authorName: parsed.data.authorName,
      authorEmail: parsed.data.authorEmail,
    });
    // Only bust the PDP cache when the review is actually visible.
    if (!settings.moderationBeforePublish) {
      revalidateStorefrontPath(`/products/${parsed.data.productSlug}`);
    }
    return {
      notice: settings.moderationBeforePublish ? "pendingModeration" : "success",
      average: reviews.average,
      count: reviews.count,
      reviews: reviews.reviews,
    };
  } catch (error) {
    console.error(
      "[product-reviews] submit failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return { notice: "publishFailed" };
  }
}
