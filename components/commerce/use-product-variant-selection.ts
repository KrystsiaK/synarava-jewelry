"use client";

import { useMemo, useState } from "react";

import {
  buildSharedVariantLineState,
  initialSelectionForProduct,
  useOptionalSharedVariantSelection,
  type VariantSelection,
} from "@/components/commerce/product-purchase-selection";
import type { ProductSummary } from "@/lib/content/catalog";

export type { VariantSelection };

/** Prefer shared PDP selection when a provider is present (no hero/compact drift). */
export function useProductVariantSelection(product: ProductSummary) {
  const shared = useOptionalSharedVariantSelection(product);
  const [selection, setSelection] = useState<VariantSelection>(() =>
    initialSelectionForProduct(product),
  );

  const local = useMemo(
    () =>
      buildSharedVariantLineState(product, selection, (_slug, next) => {
        setSelection(next);
      }),
    [product, selection],
  );

  return shared ?? local;
}
