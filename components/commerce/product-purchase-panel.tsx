"use client";

import { useMemo, useState } from "react";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { ArtifactButton } from "@/components/ui";
import type { ProductSummary } from "@/lib/content/catalog";

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

export function ProductPurchasePanel({ product, compact = false }: ProductPurchasePanelProps) {
  const purchasableVariants = useMemo(
    () => product.variantDetails.filter((variant) => variant.merchandiseId),
    [product.variantDetails],
  );
  const initialVariant =
    purchasableVariants.find((variant) => variant.stockOnHand > 0) ?? purchasableVariants[0];
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initialVariant?.selectedOptions ?? []).map((option) => [option.name, option.value]),
    ),
  );

  const selectedVariant =
    purchasableVariants.find((variant) =>
      variant.selectedOptions.every((option) => selection[option.name] === option.value),
    ) ?? (product.options.length === 0 ? initialVariant : undefined);
  const isAvailable = Boolean(selectedVariant?.merchandiseId && selectedVariant.stockOnHand > 0);

  function chooseOption(name: string, value: string) {
    setSelection((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {product.options.map((option) => (
        <fieldset key={option.name} className="space-y-2.5">
          <legend className="label-caps text-[0.64rem] text-foreground/60">
            {option.name}
          </legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const nextSelection = { ...selection, [option.name]: value };
              const compatible = purchasableVariants.some(
                (variant) => variant.stockOnHand > 0 && matchesSelection(variant, nextSelection),
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
          disabled={!isAvailable}
          unavailableLabel={purchasableVariants.length === 0 ? "Unavailable in Shopify" : "Currently unavailable"}
        />
        <div aria-live="polite">
          <p className="font-serif text-2xl text-foreground md:text-3xl">
            {selectedVariant?.price || product.price}
          </p>
          {selectedVariant ? (
            <p className="mt-1 text-xs text-foreground/55">
              {isAvailable
                ? `${selectedVariant.stockOnHand} ${selectedVariant.stockOnHand === 1 ? "piece" : "pieces"} available`
                : "This option is currently unavailable"}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
