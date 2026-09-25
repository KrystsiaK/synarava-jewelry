"use client";

import { useMemo, useState } from "react";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { ArtifactButton } from "@/components/ui";
import type { ProductSummary } from "@/lib/content/catalog";
import { useTranslations } from "@/lib/i18n/context";
import { discountPercent } from "@/lib/shopify/money";

type ProductPurchasePanelProps = {
  product: ProductSummary;
  compact?: boolean;
};

function matchesSelection(
  variant: ProductSummary["variantDetails"][number],
  selection: Record<string, string>,
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

export function ProductPurchasePanel({ product, compact = false }: ProductPurchasePanelProps) {
  const { t, plural } = useTranslations();
  const purchasableVariants = useMemo(
    () => product.variantDetails.filter((variant) => variant.merchandiseId),
    [product.variantDetails],
  );
  const initialVariant =
    purchasableVariants.find((variant) => variant.available) ?? purchasableVariants[0];
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    initialVariant ? selectionForVariant(initialVariant) : {},
  );

  const selectedVariant =
    purchasableVariants.find((variant) =>
      variant.selectedOptions.every((option) => selection[option.name] === option.value),
    ) ?? (product.options.length === 0 ? initialVariant : undefined);
  const isAvailable = Boolean(selectedVariant?.merchandiseId && selectedVariant.available);
  // A selected variant's own price/compare-at is authoritative, including when it
  // has none — falling back to product.compareAtPrice (the first variant's) here
  // used to show a different variant's discount on the selected one (REV-06).
  const price = selectedVariant ? selectedVariant.price : product.price;
  const compareAtPrice = selectedVariant ? selectedVariant.compareAtPrice : product.compareAtPrice;
  const discount = discountPercent(
    selectedVariant ? selectedVariant.priceAmount : product.priceAmount,
    selectedVariant ? selectedVariant.compareAtAmount : product.compareAtAmount,
  );

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

  return (
    <div data-component="ProductPurchasePanel" className={compact ? "space-y-4" : "border-y border-foreground/14 py-5 md:py-6"}>
      <div className={compact ? "mb-4" : "mb-5 flex flex-wrap items-end justify-between gap-4"} aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-serif text-2xl text-foreground md:text-3xl">{price}</p>
          {compareAtPrice && compareAtPrice !== price ? (
            <p className="text-sm text-foreground/48 line-through">{compareAtPrice}</p>
          ) : null}
          {discount != null ? (
            <span className="bg-couture-red px-2 py-0.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-white">
              −{discount}%
            </span>
          ) : null}
        </div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-foreground/62">
          <span className={`h-2 w-2 rounded-full ${isAvailable ? "bg-emerald-600" : "bg-couture-red"}`} aria-hidden="true" />
          {selectedVariant
            ? isAvailable
              ? plural("product.stock", selectedVariant.stockOnHand)
              : t("product.optionUnavailable")
            : purchasableVariants.length === 0
              ? t("product.shopifyUnavailable")
              : t("product.selectOption")}
        </p>
      </div>

      <div className={compact ? "space-y-4" : "space-y-5"}>
        {product.options.map((option) => (
          <fieldset key={option.name} className="space-y-2.5">
            <legend className="label-caps text-[0.64rem] text-foreground/60">
              {option.name}
            </legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const compatible = purchasableVariants.some(
                  (variant) => variant.available && variant.selectedOptions.some(
                    (selectedOption) => selectedOption.name === option.name && selectedOption.value === value,
                  ),
                );
                const selected = selection[option.name] === value;

                return (
                  <ArtifactButton
                    key={value}
                    type="button"
                    variant="choice"
                    size="sm"
                    onClick={() => chooseOption(option.name, value)}
                    disabled={!compatible}
                    aria-pressed={selected}
                    className="min-h-11 px-4 text-sm normal-case tracking-normal"
                    data-selected={selected}
                  >
                    {value}
                  </ArtifactButton>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <AddToCartButton
            productSlug={product.slug}
            merchandiseId={selectedVariant?.merchandiseId ?? undefined}
            sku={selectedVariant?.sku || product.sku}
            itemName={product.title}
            value={selectedVariant?.priceAmount ?? product.priceAmount}
            currency={product.currency}
            disabled={!isAvailable}
            unavailableLabel={purchasableVariants.length === 0 ? t("product.shopifyUnavailable") : t("product.currentlyUnavailable")}
          />
        </div>
      </div>
    </div>
  );
}
