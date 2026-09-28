export type AccountReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  submittedAt: string;
  verificationStatus: "verified_buyer" | "verified_reviewer" | "unverified";
  merchantReply: string;
  productId: string;
};

export type AccountReviewProduct = {
  shopifyProductId: string;
  slug: string;
  title: string;
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
  products: AccountReviewProduct[],
  productPath: (slug: string) => string,
): AccountReviewRow[] {
  const byId = new Map(products.map((product) => [product.shopifyProductId, product]));
  return reviews.map((review) => {
    const product = byId.get(review.productId);
    return {
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      submittedAt: review.submittedAt,
      verificationStatus: review.verificationStatus,
      merchantReply: review.merchantReply,
      productTitle: product?.title ?? null,
      productHref: product ? productPath(product.slug) : null,
    };
  });
}
