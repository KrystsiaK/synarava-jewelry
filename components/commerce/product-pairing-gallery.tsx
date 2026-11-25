"use client";

import { useOptionalProductPairingSelection } from "@/components/commerce/product-pairing-selection";
import { ProductMediaGallery } from "@/components/artifacts/product-media-gallery";
import type { ProductSummary } from "@/lib/content/catalog";

export function ProductPairingAwareGallery({ product }: { product: ProductSummary }) {
  const pairing = useOptionalProductPairingSelection();
  const partner = pairing?.selectedPartner;

  const leadingMedia = partner
    ? partner.pairImageUrl
      ? [{
          src: partner.pairImageUrl,
          alt: `${product.title} + ${partner.product.title}`,
          width: null,
          height: null,
        }]
      : [
          {
            src: product.image,
            alt: product.title,
            width: null,
            height: null,
          },
          {
            src: partner.product.image,
            alt: partner.product.title,
            width: null,
            height: null,
          },
        ]
    : undefined;

  return <ProductMediaGallery product={product} leadingMedia={leadingMedia} />;
}
