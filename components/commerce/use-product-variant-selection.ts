"use client";

import { useMemo, useState } from "react";

import {
  useOptionalSharedVariantSelection,
  type VariantSelection,
} from "@/components/commerce/product-purchase-selection";
import type { ProductSummary } from "@/lib/content/catalog";

export type { VariantSelection };

function matchesSelection(
  variant: ProductSummary["variantDetails"][number],
  selection: VariantSelection,
) {
  return variant.selectedOptions.every(
    (option) => !selection[option.name] || selection[option.name] === option.value,
  );
}

function selectionForVariant(variant: ProductSummary["variantDetails"][number]) {
  return Object.fromEntries(
    variant.selectedOptions.map((option) => [option.name, option.value]),
  );
}

/** Prefer shared PDP selection when a provider is present (no hero/compact drift). */
export function useProductVariantSelection(product: ProductSummary) {
  const shared = useOptionalSharedVariantSelection(product);
  const purchasableVariants = useMemo(
    () => product.variantDetails.filter((variant) => variant.merchandiseId),
    [product.variantDetails],
  );
  const initialVariant =
    purchasableVariants.find((variant) => variant.available) ?? purchasableVariants[0];
  const [selection, setSelection] = useState<VariantSelection>(() =>
    initialVariant ? selectionForVariant(initialVariant) : {},
  );

  if (shared) return shared;

  const selectedVariant =
    purchasableVariants.find((variant) =>
      variant.selectedOptions.every((option) => selection[option.name] === option.value),
    ) ?? (product.options.length === 0 ? initialVariant : undefined);

  function chooseOption(name: string, value: string) {
    setSelection((current) => {
      const requestedSelection = { ...current, [name]: value };
      const exactVariant = purchasableVariants.find(
        (variant) => variant.available && matchesSelection(variant, requestedSelection),
      );
      const availableVariant = exactVariant ?? purchasableVariants.find(
        (variant) => variant.available && variant.selectedOptions.some(
          (option) => option.name === name && option.value === value,
        ),
      );

      return availableVariant ? selectionForVariant(availableVariant) : requestedSelection;
    });
  }

  return {
    purchasableVariants,
    selection,
    selectedVariant,
    chooseOption,
    isAvailable: Boolean(selectedVariant?.merchandiseId && selectedVariant.available),
  };
}
