import "server-only";

import { getProductBySlug, type ProductSummary } from "@/lib/content/catalog";
import { db } from "@/lib/db";
import { getS3PublicUrl } from "@/lib/s3";
import type { Locale } from "@/lib/i18n/locales";

export type ProductPairingPartner = {
  pairingId: string;
  role: "base" | "addon";
  sortOrder: number;
  /** Ordered pair-gallery URLs (empty → storefront shows side-by-side frame). */
  pairImageUrls: string[];
  product: ProductSummary;
  available: boolean;
};

/**
 * Storefront partners for a product (either side of ProductPairing).
 * Only ACTIVE+PUBLIC partners with a Shopify variant merchandise id.
 */
export async function listStorefrontPairingPartners(
  productId: string,
  locale: Locale,
): Promise<ProductPairingPartner[]> {
  const rows = await db.productPairing.findMany({
    where: {
      OR: [{ baseProductId: productId }, { addonProductId: productId }],
    },
    include: {
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { imageAsset: { select: { key: true } } },
      },
      baseProduct: { select: { id: true, slug: true, status: true, visibility: true } },
      addonProduct: { select: { id: true, slug: true, status: true, visibility: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const partners: ProductPairingPartner[] = [];
  for (const row of rows) {
    const isBase = row.baseProductId === productId;
    const other = isBase ? row.addonProduct : row.baseProduct;
    // Pairing partners are ACTIVE+PUBLIC only — do not change global getProductBySlug policy.
    if (other.status !== "ACTIVE" || other.visibility !== "PUBLIC") continue;
    const summary = await getProductBySlug(other.slug, locale);
    if (!summary) continue;
    if (summary.variantDetails.every((variant) => !variant.merchandiseId)) continue;

    const available = summary.variantDetails.some(
      (variant) => Boolean(variant.merchandiseId) && variant.available,
    );

    partners.push({
      pairingId: row.id,
      role: isBase ? "addon" : "base",
      sortOrder: row.sortOrder,
      pairImageUrls: row.images.map((image) => getS3PublicUrl(image.imageAsset.key)),
      product: summary,
      available,
    });
  }

  return partners;
}

export async function getProductIdBySourceSlug(sourceSlug: string): Promise<string | null> {
  const product = await db.product.findFirst({
    where: { slug: sourceSlug },
    select: { id: true },
  });
  return product?.id ?? null;
}
