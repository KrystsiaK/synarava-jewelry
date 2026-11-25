"use client";

import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ProductSummary } from "@/lib/content/catalog";

export type VariantSelection = Record<string, string>;

function selectionForVariant(variant: ProductSummary["variantDetails"][number]) {
  return Object.fromEntries(
    variant.selectedOptions.map((option) => [option.name, option.value]),
  );
}

export type SharedVariantLineState = {
  selection: VariantSelection;
  purchasableVariants: ProductSummary["variantDetails"];
  selectedVariant: ProductSummary["variantDetails"][number] | undefined;
  isAvailable: boolean;
  chooseOption: (name: string, value: string) => void;
};

type PurchaseSelectionContextValue = {
  getLine: (product: ProductSummary) => SharedVariantLineState;
};

const PurchaseSelectionContext = createContext<PurchaseSelectionContextValue | null>(null);

function initialSelectionFor(product: ProductSummary): VariantSelection {
  const purchasable = product.variantDetails.filter((variant) => variant.merchandiseId);
  const initial = purchasable.find((variant) => variant.available) ?? purchasable[0];
  return initial ? selectionForVariant(initial) : {};
}

function buildLineState(
  product: ProductSummary,
  selection: VariantSelection,
  setSelection: (slug: string, next: VariantSelection) => void,
): SharedVariantLineState {
  const purchasableVariants = product.variantDetails.filter((variant) => variant.merchandiseId);
  const selectedVariant =
    purchasableVariants.find((variant) =>
      variant.selectedOptions.every((option) => selection[option.name] === option.value),
    ) ?? (product.options.length === 0
      ? purchasableVariants.find((variant) => variant.available) ?? purchasableVariants[0]
      : undefined);

  function chooseOption(name: string, value: string) {
    const requestedSelection = { ...selection, [name]: value };
    const exactVariant = purchasableVariants.find(
      (variant) =>
        variant.available
        && variant.selectedOptions.every(
          (option) => !requestedSelection[option.name] || requestedSelection[option.name] === option.value,
        ),
    );
    const availableVariant = exactVariant ?? purchasableVariants.find(
      (variant) => variant.available && variant.selectedOptions.some(
        (option) => option.name === name && option.value === value,
      ),
    );
    setSelection(
      product.slug,
      availableVariant ? selectionForVariant(availableVariant) : requestedSelection,
    );
  }

  return {
    selection,
    purchasableVariants,
    selectedVariant,
    isAvailable: Boolean(selectedVariant?.merchandiseId && selectedVariant.available),
    chooseOption,
  };
}

/** Shared variant picks for every ProductPurchasePanel on the PDP (hero + compact). */
export function ProductPurchaseSelectionProvider({
  products,
  children,
}: {
  products: ProductSummary[];
  children: ReactNode;
}) {
  const [bySlug, setBySlug] = useState<Record<string, VariantSelection>>(() =>
    Object.fromEntries(products.map((product) => [product.slug, initialSelectionFor(product)])),
  );

  const setSelection = useCallback((slug: string, next: VariantSelection) => {
    setBySlug((current) => ({ ...current, [slug]: next }));
  }, []);

  // Missing slugs (e.g. newly selected partner) fall back during render — no sync effect.
  const value = useMemo<PurchaseSelectionContextValue>(() => ({
    getLine: (product: ProductSummary) => {
      const selection = bySlug[product.slug] ?? initialSelectionFor(product);
      return buildLineState(product, selection, setSelection);
    },
  }), [bySlug, setSelection]);

  return (
    <PurchaseSelectionContext value={value}>
      {children}
    </PurchaseSelectionContext>
  );
}

export function useOptionalSharedVariantSelection(
  product: ProductSummary,
): SharedVariantLineState | null {
  const shared = use(PurchaseSelectionContext);
  return shared ? shared.getLine(product) : null;
}
