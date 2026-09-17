import type { ProductSummary } from "@/lib/content/catalog";
import type { ShopifyProductReviews } from "@/lib/shopify/product-reviews";
import { localePath } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n/locales";

export function buildProductJsonLd(
  product: ProductSummary,
  siteUrl: string,
  reviews?: ShopifyProductReviews | null,
  locale: Locale = "en",
) {
  const baseUrl = siteUrl.replace(/\/$/, "");
  const productUrl = `${baseUrl}${localePath(locale, `/products/${encodeURIComponent(product.slug)}`)}`;
  const images = Array.from(new Set([
    product.image,
    ...product.commerceMedia.map((media) => media.src),
  ].filter(Boolean)));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    url: productUrl,
    name: product.title,
    description: product.shortDescription || product.description,
    ...(images.length > 0 ? { image: images } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.shopifyCategoryName ? { category: product.shopifyCategoryName } : {}),
    brand: {
      "@type": "Brand",
      name: product.vendor || "Synarava",
    },
    ...(reviews?.average != null && reviews.count > 0 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: reviews.average,
        reviewCount: reviews.count,
      },
      review: reviews.reviews.map((review) => ({
        "@type": "Review",
        ...(review.title ? { name: review.title } : {}),
        ...(review.body ? { reviewBody: review.body } : {}),
        datePublished: review.submittedAt,
        reviewRating: {
          "@type": "Rating",
          ratingValue: review.rating,
          bestRating: 5,
          worstRating: 1,
        },
        author: { "@type": "Person", name: review.authorDisplayName },
      })),
    } : {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: product.currency,
      price: product.priceAmount.toFixed(2),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Synarava" },
    },
  };
}
