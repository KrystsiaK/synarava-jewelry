"use client";

import Link from "next/link";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { useOptionalProductPairingSelection } from "@/components/commerce/product-pairing-selection";
import { useProductVariantSelection } from "@/components/commerce/use-product-variant-selection";
import { ArtifactButton } from "@/components/ui";
import { purchaseStockSignal } from "@/lib/commerce/purchase-availability";
import type { ProductSummary } from "@/lib/content/catalog";
import { useTranslations } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/i18n/format";
import { localePath } from "@/lib/i18n/routing";
import { discountPercent } from "@/lib/shopify/money";

type ProductPurchasePanelProps = {
  product: ProductSummary;
  compact?: boolean;
};

function OptionButtons({
  product,
  selection,
  purchasableVariants,
  chooseOption,
}: {
  product: ProductSummary;
  selection: Record<string, string>;
  purchasableVariants: ProductSummary["variantDetails"];
  chooseOption: (name: string, value: string) => void;
}) {
  return (
    <>
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
                  className="min-h-11 min-w-11 px-4 text-sm normal-case tracking-normal"
                  data-selected={selected}
                >
                  {value}
                </ArtifactButton>
              );
            })}
          </div>
        </fieldset>
      ))}
    </>
  );
}

function stockLabel(
  signal: ReturnType<typeof purchaseStockSignal>,
  t: ReturnType<typeof useTranslations>["t"],
  plural: ReturnType<typeof useTranslations>["plural"],
) {
  switch (signal.labelKind) {
    case "in_stock_count":
      return plural("product.stock", signal.stockOnHand);
    case "available":
      return t("product.availableWithoutCount");
    case "out_of_stock":
      return t("product.outOfStock");
    case "shopify_unavailable":
      return t("product.shopifyUnavailable");
    case "select_option":
      return t("product.selectOption");
  }
}

function unavailableCtaLabel(
  signal: ReturnType<typeof purchaseStockSignal>,
  t: ReturnType<typeof useTranslations>["t"],
) {
  if (signal.labelKind === "shopify_unavailable") return t("product.shopifyUnavailable");
  if (signal.labelKind === "select_option") return t("product.selectOption");
  return t("product.outOfStock");
}

function StockStatusRow({
  signal,
  restockNotice,
}: {
  signal: ReturnType<typeof purchaseStockSignal>;
  restockNotice: string;
}) {
  const { t, plural } = useTranslations();
  const dotClass = signal.showInStockDot
    ? "bg-emerald-600"
    : signal.canPurchase
      ? "bg-foreground/35"
      : "bg-couture-red";

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-foreground/62">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
        {stockLabel(signal, t, plural)}
      </p>
      {restockNotice ? (
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-foreground/62">
          {restockNotice}
        </p>
      ) : null}
    </div>
  );
}

function StandalonePurchase({
  product,
  compact,
}: {
  product: ProductSummary;
  compact: boolean;
}) {
  const { t } = useTranslations();
  const {
    purchasableVariants,
    selection,
    selectedVariant,
    chooseOption,
  } = useProductVariantSelection(product);

  const signal = purchaseStockSignal({
    selectedVariant,
    purchasableVariantCount: purchasableVariants.length,
  });
  const restockNotice =
    selectedVariant && !selectedVariant.available
      ? t("product.restockNotice").trim()
      : "";
  const price = selectedVariant ? selectedVariant.price : product.price;
  const compareAtPrice = selectedVariant ? selectedVariant.compareAtPrice : product.compareAtPrice;
  const discount = discountPercent(
    selectedVariant ? selectedVariant.priceAmount : product.priceAmount,
    selectedVariant ? selectedVariant.compareAtAmount : product.compareAtAmount,
  );

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
        <StockStatusRow signal={signal} restockNotice={restockNotice} />
      </div>

      <div className={compact ? "space-y-4" : "space-y-5"}>
        <OptionButtons
          product={product}
          selection={selection}
          purchasableVariants={purchasableVariants}
          chooseOption={chooseOption}
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <AddToCartButton
            productSlug={product.slug}
            merchandiseId={selectedVariant?.merchandiseId ?? undefined}
            sku={selectedVariant?.sku || product.sku}
            itemName={product.title}
            value={selectedVariant ? selectedVariant.priceAmount : product.priceAmount}
            currency={product.currency}
            disabled={!signal.canPurchase}
            unavailableLabel={unavailableCtaLabel(signal, t)}
          />
        </div>
      </div>
    </div>
  );
}

function KitLine({
  product,
  state,
}: {
  product: ProductSummary;
  state: ReturnType<typeof useProductVariantSelection>;
}) {
  const { t, locale } = useTranslations();
  const price = state.selectedVariant ? state.selectedVariant.price : product.price;
  const compareAtPrice = state.selectedVariant
    ? state.selectedVariant.compareAtPrice
    : product.compareAtPrice;
  const discount = discountPercent(
    state.selectedVariant ? state.selectedVariant.priceAmount : product.priceAmount,
    state.selectedVariant ? state.selectedVariant.compareAtAmount : product.compareAtAmount,
  );
  const signal = purchaseStockSignal({
    selectedVariant: state.selectedVariant,
    purchasableVariantCount: state.purchasableVariants.length,
  });
  const restockNotice =
    state.selectedVariant && !state.selectedVariant.available
      ? t("product.restockNotice").trim()
      : "";

  return (
    <div data-product-slug={product.slug} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link
          href={localePath(locale, `/products/${product.slug}`)}
          className="font-serif text-xl text-foreground underline-offset-4 hover:text-couture-red hover:underline"
        >
          {product.title}
        </Link>
        <div className="text-right" aria-live="polite">
          <p className="font-serif text-xl text-foreground">{price}</p>
          {compareAtPrice && compareAtPrice !== price ? (
            <p className="text-sm text-foreground/48 line-through">{compareAtPrice}</p>
          ) : null}
          {discount != null ? (
            <span className="mt-1 inline-block bg-couture-red px-2 py-0.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-white">
              −{discount}%
            </span>
          ) : null}
        </div>
      </div>

      <StockStatusRow signal={signal} restockNotice={restockNotice} />

      <OptionButtons
        product={product}
        selection={state.selection}
        purchasableVariants={state.purchasableVariants}
        chooseOption={state.chooseOption}
      />
    </div>
  );
}

function KitPurchase({
  product,
  partnerProduct,
  compact,
}: {
  product: ProductSummary;
  partnerProduct: ProductSummary;
  compact: boolean;
}) {
  const { t, locale } = useTranslations();
  const primary = useProductVariantSelection(product);
  const secondary = useProductVariantSelection(partnerProduct);

  const primarySignal = purchaseStockSignal({
    selectedVariant: primary.selectedVariant,
    purchasableVariantCount: primary.purchasableVariants.length,
  });
  const secondarySignal = purchaseStockSignal({
    selectedVariant: secondary.selectedVariant,
    purchasableVariantCount: secondary.purchasableVariants.length,
  });
  const kitAvailable = primarySignal.canPurchase && secondarySignal.canPurchase;
  const primaryPrice = primary.selectedVariant?.priceAmount ?? product.priceAmount;
  const secondaryPrice = secondary.selectedVariant?.priceAmount ?? partnerProduct.priceAmount;
  const kitTotal = primaryPrice + secondaryPrice;

  const unavailableTitles = [
    !primarySignal.canPurchase ? product.title : null,
    !secondarySignal.canPurchase ? partnerProduct.title : null,
  ].filter(Boolean) as string[];

  return (
    <div
      data-component="ProductPurchasePanel"
      data-pairing="kit"
      className={compact ? "space-y-5" : "space-y-6 border-y border-foreground/14 py-5 md:py-6"}
    >
      <KitLine product={product} state={primary} />
      <KitLine product={partnerProduct} state={secondary} />

      {unavailableTitles.length > 0 ? (
        <ul className="space-y-1 text-xs font-semibold uppercase tracking-[0.13em] text-couture-red">
          {unavailableTitles.map((title) => (
            <li key={title}>
              {t("product.pairings.kitUnavailableNotice", { title })}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="font-serif text-2xl text-foreground">
        {t("product.pairings.kitTotal", {
          total: formatCurrency(kitTotal, product.currency, locale),
        })}
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <AddToCartButton
          lines={[
            {
              productSlug: product.slug,
              merchandiseId: primary.selectedVariant?.merchandiseId ?? undefined,
              sku: primary.selectedVariant?.sku || product.sku,
              itemName: product.title,
              price: primaryPrice,
            },
            {
              productSlug: partnerProduct.slug,
              merchandiseId: secondary.selectedVariant?.merchandiseId ?? undefined,
              sku: secondary.selectedVariant?.sku || partnerProduct.sku,
              itemName: partnerProduct.title,
              price: secondaryPrice,
            },
          ]}
          value={kitTotal}
          currency={product.currency}
          disabled={!kitAvailable}
          label={t("product.pairings.addKit")}
          unavailableLabel={t("product.outOfStock")}
        />
        <AddToCartButton
          productSlug={product.slug}
          merchandiseId={primary.selectedVariant?.merchandiseId ?? undefined}
          sku={primary.selectedVariant?.sku || product.sku}
          itemName={product.title}
          value={primaryPrice}
          currency={product.currency}
          disabled={!primarySignal.canPurchase}
          label={t("product.pairings.addCurrentOnly")}
          variant="secondary"
          unavailableLabel={unavailableCtaLabel(primarySignal, t)}
        />
      </div>
    </div>
  );
}

/** Hero + compact panels share partner selection via ProductPairingSelectionProvider. */
export function ProductPurchasePanel({ product, compact = false }: ProductPurchasePanelProps) {
  const pairing = useOptionalProductPairingSelection();
  if (pairing?.selectedPartner) {
    return (
      <KitPurchase
        product={product}
        partnerProduct={pairing.selectedPartner.product}
        compact={compact}
      />
    );
  }
  return <StandalonePurchase product={product} compact={compact} />;
}
