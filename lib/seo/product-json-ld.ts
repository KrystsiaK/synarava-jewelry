import type { ProductSummary } from "@/lib/content/catalog";

export function buildProductJsonLd(product: ProductSummary, siteUrl: string) {
  const baseUrl = siteUrl.replace(/\/$/, "");
  const productUrl = `${baseUrl}/products/${encodeURIComponent(product.slug)}`;
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
    ...(product.categoryName ? { category: product.categoryName } : {}),
    brand: {
      "@type": "Brand",
      name: product.vendor || "Synarava",
    },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: product.currency,
      price: product.priceAmount.toFixed(2),
      availability: product.stockOnHand > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Synarava" },
    },
  };
}
