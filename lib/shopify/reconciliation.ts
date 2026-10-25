export type RemoteProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED" | "UNLISTED";

/**
 * A product only reaches the Synarava storefront when it's both ACTIVE
 * *and* actually published to Shopify's Online Store channel — a product
 * can be ACTIVE while published only to POS or another sales channel, and
 * status alone would wrongly surface it here.
 */
export function synaravaVisibilityForShopifyProduct(status: RemoteProductStatus, isPublishedOnline: boolean) {
  if (!isPublishedOnline) return "PRIVATE" as const;
  if (status === "ACTIVE") return "PUBLIC" as const;
  if (status === "UNLISTED") return "UNLISTED" as const;
  return "PRIVATE" as const;
}

export function isSynaravaProductAccessible(
  status: RemoteProductStatus,
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC",
) {
  return (status === "ACTIVE" && visibility === "PUBLIC") ||
    (status === "UNLISTED" && visibility === "UNLISTED");
}

export async function refreshShopifyProductAfterPush<T extends { id: string }>(
  product: T,
  fetchProduct: (id: string) => Promise<T | null>,
  options?: {
    /** Retry until this returns true (e.g. inventory quantity has settled). */
    isSettled?: (fresh: T) => boolean;
    attempts?: number;
    delayMs?: number;
  },
) {
  const attempts = Math.max(1, options?.attempts ?? 1);
  const delayMs = Math.max(0, options?.delayMs ?? 150);
  let latest = product;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const fresh = await fetchProduct(product.id);
    if (!fresh) return latest;
    latest = fresh;
    if (!options?.isSettled || options.isSettled(fresh)) return latest;
    if (attempt < attempts - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  return latest;
}

export function pickShopifyProductImageUrl({
  featuredImageUrl,
  media,
}: {
  featuredImageUrl?: string | null;
  media: Array<{ mediaContentType?: string | null; imageUrl?: string | null }>;
}) {
  return featuredImageUrl?.trim() ||
    media.find((item) => item.mediaContentType === "IMAGE" && item.imageUrl?.trim())?.imageUrl?.trim() ||
    null;
}

export function diffCollectionMembership(
  desiredCollectionIds: string[],
  currentCollectionIds: string[],
): { toJoin: string[]; toLeave: string[] } {
  const desired = new Set(desiredCollectionIds);
  const current = new Set(currentCollectionIds);
  return {
    toJoin: desiredCollectionIds.filter((id) => !current.has(id)),
    toLeave: currentCollectionIds.filter((id) => !desired.has(id)),
  };
}
