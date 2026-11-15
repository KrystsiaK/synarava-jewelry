/**
 * Storefront / JSON-LD review shape. Never includes authorEmail.
 */
export type PublicProductReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  authorDisplayName: string;
  submittedAt: string;
  verificationStatus: "verified_buyer" | "unverified";
  merchantReply: string;
  merchantRepliedAt: string | null;
};

export type ProductReviewsData = {
  reviews: PublicProductReview[];
  average: number | null;
  count: number;
};

export const EMPTY_PRODUCT_REVIEWS: ProductReviewsData = {
  reviews: [],
  average: null,
  count: 0,
};
