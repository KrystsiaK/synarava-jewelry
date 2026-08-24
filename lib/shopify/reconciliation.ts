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

function cents(value: string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

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
    shopify: (variant: RemoteCommerceVariant) => cents(variant.price),
  },
  {
    field: "compareAtPrice" as const,
    local: (variant: LocalCommerceVariant) => variant.compareAtCents,
    shopify: (variant: RemoteCommerceVariant) =>
      variant.compareAtPrice == null ? null : cents(variant.compareAtPrice),
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
