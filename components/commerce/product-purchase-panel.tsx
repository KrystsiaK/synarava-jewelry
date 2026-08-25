"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { ArtifactButton } from "@/components/ui";
import { getProductPresentation } from "@/lib/catalog/product-presentation";
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

function selectionForVariant(variant: ProductSummary["variantDetails"][number]) {
  return Object.fromEntries(
    variant.selectedOptions.map((option) => [option.name, option.value]),
  );
}

export function ProductPurchasePanel({ product, compact = false }: ProductPurchasePanelProps) {
  const presentation = getProductPresentation(product.departmentSlug);
  const purchasableVariants = useMemo(
    () => product.variantDetails.filter((variant) => variant.merchandiseId),
    [product.variantDetails],
  );
  const initialVariant =
    purchasableVariants.find((variant) => variant.stockOnHand > 0) ?? purchasableVariants[0];
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    initialVariant ? selectionForVariant(initialVariant) : {},
  );

  const selectedVariant =
    purchasableVariants.find((variant) =>
      variant.selectedOptions.every((option) => selection[option.name] === option.value),
    ) ?? (product.options.length === 0 ? initialVariant : undefined);
  const isAvailable = Boolean(selectedVariant?.merchandiseId && selectedVariant.stockOnHand > 0);
  const price = selectedVariant?.price || product.price;
  const compareAtPrice = selectedVariant?.compareAtPrice || product.compareAtPrice;

  function chooseOption(name: string, value: string) {
    setSelection((current) => {
      const requestedSelection = { ...current, [name]: value };
      const exactVariant = purchasableVariants.find(
        (variant) => variant.stockOnHand > 0 && matchesSelection(variant, requestedSelection),
      );
      const availableVariant = exactVariant ?? purchasableVariants.find(
        (variant) => variant.stockOnHand > 0 && variant.selectedOptions.some(
          (option) => option.name === name && option.value === value,
        ),
      );

      return availableVariant ? selectionForVariant(availableVariant) : requestedSelection;
    });
  }

  return (
    <div className={compact ? "space-y-4" : "border-y border-foreground/14 py-5 md:py-6"}>
      <div className={compact ? "mb-4" : "mb-5 flex flex-wrap items-end justify-between gap-4"} aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-serif text-2xl text-foreground md:text-3xl">{price}</p>
          {compareAtPrice && compareAtPrice !== price ? (
            <p className="text-sm text-foreground/48 line-through">{compareAtPrice}</p>
          ) : null}
        </div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-foreground/62">
          <span className={`h-2 w-2 rounded-full ${isAvailable ? "bg-emerald-600" : "bg-couture-red"}`} aria-hidden="true" />
          {selectedVariant
            ? isAvailable
              ? `${selectedVariant.stockOnHand} in stock`
              : "This option is unavailable"
            : purchasableVariants.length === 0
              ? "Unavailable in Shopify"
              : "Select an option"}
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
                  (variant) => variant.stockOnHand > 0 && variant.selectedOptions.some(
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
            disabled={!isAvailable}
            unavailableLabel={purchasableVariants.length === 0 ? "Unavailable in Shopify" : "Currently unavailable"}
          />
        </div>
      </div>

      {!compact ? (
        <div className="mt-6 border-t border-foreground/12 pt-5">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground/78">
              {presentation.buyingTitle}
            </p>
            <p className="text-sm leading-6 text-foreground/62">
              {presentation.buyingBody}
            </p>
          </div>

          <nav className="mt-5 grid border-y border-foreground/12 sm:grid-cols-3" aria-label="Purchase information">
            {[
              { href: "/shipping", label: "Delivery", detail: "Calculated at checkout" },
              { href: "/returns", label: "Returns", detail: "Review the return window" },
              { href: "/care", label: "Care & safety", detail: "Use and care guidance" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex min-h-16 flex-col justify-center border-b border-foreground/12 py-3 text-left last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"
              >
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/78 transition-colors group-hover:text-couture-red">
                  {item.label}
                </span>
                <span className="mt-1 text-xs text-foreground/48">{item.detail}</span>
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
