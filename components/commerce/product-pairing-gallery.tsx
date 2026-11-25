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
          width: null as number | null,
          height: null as number | null,
        }]
      : product.image && partner.product.image
        ? [{
            // One main frame: current + partner side-by-side (not two slides).
            src: product.image,
            alt: product.title,
            width: null as number | null,
            height: null as number | null,
            companionSrc: partner.product.image,
            companionAlt: partner.product.title,
          }]
        : undefined
    : undefined;

  return <ProductMediaGallery product={product} leadingMedia={leadingMedia} />;
}
