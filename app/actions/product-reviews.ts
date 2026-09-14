"use server";

import { createHash } from "node:crypto";
import { z } from "zod";

import { checkRateLimit } from "@/lib/auth/rate-limit";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { db } from "@/lib/db";
import { parseFormData } from "@/lib/forms/parse-form-data";
import {
  findShopifyCustomerOrderForProduct,
  getShopifyCustomerProfile,
} from "@/lib/shopify/customer-account/api";
import { upsertShopifyProductReview, type ShopifyProductReview } from "@/lib/shopify/product-reviews";

const reviewSchema = z.object({
  productSlug: z.string().trim().min(1).max(200),
  rating: z.coerce.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  title: z.string().trim().max(120, "Keep the title under 120 characters.").default(""),
  body: z.string().trim().max(2_000, "Keep the review under 2,000 characters.")
    .refine((value) => value.length === 0 || value.length >= 10, "Write at least 10 characters, or leave this blank.")
    .default(""),
  locale: z.enum(["en", "pt"]).default("en"),
});

export type ProductReviewActionState = {
  error?: string;
  success?: string;
  requiresLogin?: boolean;
  fieldErrors?: Partial<Record<"rating" | "title" | "body", string>>;
  average?: number | null;
  count?: number;
  reviews?: ShopifyProductReview[];
};

function reviewHandle(productId: string, customerId: string) {
  return `synarava-${createHash("sha256")
    .update(`${productId}:${customerId}`)
    .digest("hex")
    .slice(0, 40)}`;
}

function publicAuthorName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "Shopify customer";
  return `${parts[0]} ${Array.from(parts.at(-1) ?? "")[0] ?? ""}.`;
}

export async function submitProductReviewAction(
  _state: ProductReviewActionState,
  formData: FormData,
): Promise<ProductReviewActionState> {
  const parsed = parseFormData(formData, reviewSchema);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      error: "Check the highlighted review fields.",
      fieldErrors: {
        rating: fields.rating?.[0],
        title: fields.title?.[0],
        body: fields.body?.[0],
      },
    };
  }

  let customer: Awaited<ReturnType<typeof getShopifyCustomerProfile>>;
  try {
    customer = await getShopifyCustomerProfile();
  } catch {
    return { error: "Shopify could not verify your customer account. Please try again later." };
  }
  if (!customer) {
    return { error: "Sign in with Shopify to write a review.", requiresLogin: true };
  }

  const product = await db.product.findUnique({
    where: { slug: parsed.data.productSlug },
    select: { shopifyProductId: true },
  });
  if (!product?.shopifyProductId) {
    return { error: "This product is not ready for Shopify reviews yet." };
  }

  const rateLimit = await checkRateLimit(
    "product-review",
    `${customer.id}:${product.shopifyProductId}`,
    { max: 5, windowMs: 24 * 60 * 60 * 1_000 },
  );
  if (!rateLimit.ok) return { error: rateLimit.error };

  try {
    const matchingOrderId = await findShopifyCustomerOrderForProduct(product.shopifyProductId);
    const reviews = await upsertShopifyProductReview({
      handle: reviewHandle(product.shopifyProductId, customer.id),
      rating: parsed.data.rating,
      title: parsed.data.title,
      body: parsed.data.body,
      productId: product.shopifyProductId,
      customerId: customer.id,
      authorDisplayName: publicAuthorName(customer.displayName),
      orderId: matchingOrderId,
      language: parsed.data.locale,
      submittedAt: new Date().toISOString(),
    });
    revalidateStorefrontPath(`/products/${parsed.data.productSlug}`);
    return {
      success: "Your review is now published.",
      average: reviews.average,
      count: reviews.count,
      reviews: reviews.reviews,
    };
  } catch {
    return {
      error: "Shopify could not publish the review. Please try again later.",
    };
  }
}
