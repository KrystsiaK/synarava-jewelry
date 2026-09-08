import { shopifyAmountToCents } from "@/lib/shopify/money";

export type LocalCommerceVariant = {
  shopifyVariantId: string | null;
  sku: string;
  priceCents: number;
  compareAtCents: number | null;
  stockOnHand: number;
};

export type RemoteCommerceVariant = {
  id: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity?: number | null;
};

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
) {
  return await fetchProduct(product.id) ?? product;
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

export type VariantCommerceDifference = {
  variant: string;
  field: "variant" | "sku" | "price" | "compareAtPrice" | "inventoryQuantity";
  local: string | number | null;
  shopify: string | number | null;
};

type MatchedVariants = {
  local: LocalCommerceVariant;
  remote: RemoteCommerceVariant;
};


function variantLabel(variant: LocalCommerceVariant | RemoteCommerceVariant) {
  return variant.sku?.trim() || ("id" in variant ? variant.id : variant.shopifyVariantId) || "Unknown variant";
}

function matchVariants(
  localVariants: LocalCommerceVariant[],
  remoteVariants: RemoteCommerceVariant[],
) {
  const availableLocal = new Set(localVariants);
  const matches: MatchedVariants[] = [];
  const missingRemote: RemoteCommerceVariant[] = [];

  for (const remote of remoteVariants) {
    const local = localVariants.find((candidate) =>
      availableLocal.has(candidate) &&
      (candidate.shopifyVariantId === remote.id ||
        (Boolean(candidate.sku.trim()) && candidate.sku.trim() === remote.sku?.trim())),
    );

    if (!local) {
      missingRemote.push(remote);
      continue;
    }

    availableLocal.delete(local);
    matches.push({ local, remote });
  }

  return { matches, missingLocal: Array.from(availableLocal), missingRemote };
}

const VARIANT_FIELD_COMPARATORS = [
  {
    field: "sku" as const,
    local: (variant: LocalCommerceVariant) => variant.sku.trim(),
    shopify: (variant: RemoteCommerceVariant) => variant.sku?.trim() ?? "",
  },
  {
    field: "price" as const,
    local: (variant: LocalCommerceVariant) => variant.priceCents,
    shopify: (variant: RemoteCommerceVariant) => shopifyAmountToCents(variant.price),
  },
  {
    field: "compareAtPrice" as const,
    local: (variant: LocalCommerceVariant) => variant.compareAtCents,
    shopify: (variant: RemoteCommerceVariant) =>
      variant.compareAtPrice == null ? null : shopifyAmountToCents(variant.compareAtPrice),
  },
  {
    field: "inventoryQuantity" as const,
    local: (variant: LocalCommerceVariant) => variant.stockOnHand,
    shopify: (variant: RemoteCommerceVariant) => variant.inventoryQuantity ?? 0,
  },
] as const;

export function compareVariantCommerce(
  localVariants: LocalCommerceVariant[],
  remoteVariants: RemoteCommerceVariant[],
): VariantCommerceDifference[] {
  const { matches, missingLocal, missingRemote } = matchVariants(localVariants, remoteVariants);
  const differences: VariantCommerceDifference[] = [];

  for (const { local, remote } of matches) {
    for (const comparator of VARIANT_FIELD_COMPARATORS) {
      const localValue = comparator.local(local);
      const shopifyValue = comparator.shopify(remote);
      if (localValue !== shopifyValue) {
        differences.push({
          variant: variantLabel(remote),
          field: comparator.field,
          local: localValue,
          shopify: shopifyValue,
        });
      }
    }
  }

  for (const local of missingLocal) {
    differences.push({
      variant: variantLabel(local),
      field: "variant",
      local: "Present",
      shopify: "Missing",
    });
  }

  for (const remote of missingRemote) {
    differences.push({
      variant: variantLabel(remote),
      field: "variant",
      local: "Missing",
      shopify: "Present",
    });
  }

  return differences;
}

const VARIANT_CHANGE_LABELS: Record<VariantCommerceDifference["field"], string> = {
  variant: "Variants",
  sku: "Variant SKU",
  price: "Price",
  compareAtPrice: "Compare-at price",
  inventoryQuantity: "Available quantity",
};

export function variantCommerceChangeLabel(
  field: VariantCommerceDifference["field"],
) {
  return VARIANT_CHANGE_LABELS[field];
}

export function variantCommerceChangeLabels(
  differences: VariantCommerceDifference[],
) {
  return Array.from(
    new Set(differences.map((difference) => variantCommerceChangeLabel(difference.field))),
  );
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

export function classifyRemoteReconciliationAction({
  hasUnresolvedConflict = false,
  localHasChanges,
  remoteHasChanges,
}: {
  hasUnresolvedConflict?: boolean;
  localHasChanges: boolean;
  remoteHasChanges: boolean;
}) {
  if (hasUnresolvedConflict || (localHasChanges && remoteHasChanges)) return "CONFLICT" as const;
  if (remoteHasChanges) return "UPDATE_LOCAL" as const;
  return "UP_TO_DATE" as const;
}
