import { buildFinalCtaImages, type HomeCollectionMedia } from "@/lib/content/home-media";

export type FinalCtaProductMedia = {
  id: string;
  image?: string | null;
};

/**
 * Resolve the four Final CTA collage images.
 * Prefer explicit product picks; otherwise fall back to featured-collection media.
 */
export function resolveFinalCtaImages(
  products: FinalCtaProductMedia[],
  selectedIds: string[] | undefined | null,
  fallback: HomeCollectionMedia[],
): HomeCollectionMedia[] {
  const byId = new Map(
    products
      .filter((product): product is FinalCtaProductMedia & { image: string } => Boolean(product.image))
      .map((product) => [product.id, product]),
  );
  const selected = [...new Set((selectedIds ?? []).map((id) => id.trim()).filter(Boolean))]
    .map((id) => byId.get(id))
    .filter((product): product is FinalCtaProductMedia & { image: string } => Boolean(product));

  if (selected.length > 0) {
    return buildFinalCtaImages(selected.map((product) => ({ image: product.image })));
  }

  return buildFinalCtaImages(fallback);
}
