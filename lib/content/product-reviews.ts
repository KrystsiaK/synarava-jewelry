import "server-only";

import { db } from "@/lib/db";
import { getPublishedProductReviewsBySlug, getCustomerLocalReviews } from "@/lib/reviews/queries";
import type { ProductReviewsData } from "@/lib/reviews/public";
import { localePath } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n/locales";
import {
  toAccountReviewRows,
  type AccountReviewRow,
} from "@/lib/profile/account-reviews";

export async function getProductReviewsBySlug(
  slug: string,
): Promise<ProductReviewsData> {
  return getPublishedProductReviewsBySlug(slug);
}

export async function getCustomerProductReviews(
  email: string | null | undefined,
  locale: Locale,
): Promise<AccountReviewRow[]> {
  const rows = await getCustomerLocalReviews(email);
  return toAccountReviewRows(
    rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      body: row.body,
      submittedAt: row.createdAt.toISOString(),
      verificationStatus: row.verifiedPurchase ? "verified_buyer" : "unverified",
      merchantReply: "",
      productId: row.productId,
      productSlug: row.product.slug,
      productTitle: row.product.name,
    })),
    (slug) => localePath(locale, `/products/${slug}`),
  );
}

export async function listReviewProductOptions() {
  return db.product.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
}
