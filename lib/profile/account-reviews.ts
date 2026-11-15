export type AccountReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  submittedAt: string;
  verificationStatus: "verified_buyer" | "verified_reviewer" | "unverified";
  merchantReply: string;
  productId: string;
  productSlug: string;
  productTitle: string;
};

export type AccountReviewRow = {
  id: string;
  rating: number;
  title: string;
  body: string;
  submittedAt: string;
  verificationStatus: AccountReview["verificationStatus"];
  merchantReply: string;
  productTitle: string | null;
  productHref: string | null;
};

export function toAccountReviewRows(
  reviews: AccountReview[],
  productPath: (slug: string) => string,
): AccountReviewRow[] {
  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    submittedAt: review.submittedAt,
    verificationStatus: review.verificationStatus,
    merchantReply: review.merchantReply,
    productTitle: review.productTitle || null,
    productHref: review.productSlug ? productPath(review.productSlug) : null,
  }));
}
