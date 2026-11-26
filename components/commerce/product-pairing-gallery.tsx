"use client";

import { useOptionalProductPairingSelection } from "@/components/commerce/product-pairing-selection";
import { ProductMediaGallery } from "@/components/artifacts/product-media-gallery";
import type { ProductSummary } from "@/lib/content/catalog";

export function ProductPairingAwareGallery({ product }: { product: ProductSummary }) {
  const pairing = useOptionalProductPairingSelection();
  const partner = pairing?.selectedPartner;

  if (!partner) {
    return <ProductMediaGallery product={product} />;
  }

  const pairUrls = partner.pairImageUrls;
  if (pairUrls.length > 0) {
    return (
      <ProductMediaGallery
        product={product}
        mediaMode="replace"
        leadingMedia={pairUrls.map((src) => ({
          src,
          alt: `${product.title} + ${partner.product.title}`,
          width: null as number | null,
          height: null as number | null,
        }))}
      />
    );
  }

  // Zero pairing photos: exactly one frame with both products side-by-side.
  if (product.image && partner.product.image) {
    return (
      <ProductMediaGallery
        product={product}
        mediaMode="replace"
        leadingMedia={[
          {
            src: product.image,
            alt: product.title,
            width: null as number | null,
            height: null as number | null,
            companionSrc: partner.product.image,
            companionAlt: partner.product.title,
          },
        ]}
      />
    );
  }

  // Incomplete imagery — still replace product gallery so product photos stay out.
  const fallbackSrc = product.image || partner.product.image;
  if (!fallbackSrc) return null;

  return (
    <ProductMediaGallery
      product={product}
      mediaMode="replace"
      leadingMedia={[
        {
          src: fallbackSrc,
          alt: product.image ? product.title : partner.product.title,
          width: null,
          height: null,
        },
      ]}
    />
  );
}
