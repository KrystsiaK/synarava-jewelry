"use client";

import { useState } from "react";

import {
  AdminCheckboxControl,
  AdminCollapsiblePanel,
  AdminHelp,
  AdminReadonlyField,
  AdminTextField,
  type AdminFormValidation,
} from "@/components/synarava-cms";
import {
  PRODUCT_FIELD_MESSAGES,
  type ProductFieldName,
} from "@/lib/products/product-form-validation";

function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) return null;
  return amount;
}

function formatMoney(amount: number | null): string {
  if (amount == null) return "—";
  return amount.toLocaleString("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMargin(price: number | null, cost: number | null): string {
  if (price == null || cost == null || price <= 0) return "—";
  const margin = ((price - cost) / price) * 100;
  if (!Number.isFinite(margin)) return "—";
  return `${margin.toFixed(1)}%`;
}

function formatCompareAtDisplay(raw: string): string | null {
  const amount = parseMoneyInput(raw);
  if (amount == null || amount <= 0) return null;
  return formatMoney(amount);
}

/**
 * Shopify Price card projection: price, compare-at (read-only), taxable, cost.
 * Profit / margin are local calculations (not Shopify fields).
 * Compare-at is edited only in Shopify Admin until legal display rules are settled.
 */
export function ProductPriceFields({
  draft,
  fieldErrors,
  validation,
}: {
  draft: {
    price: string;
    compareAt: string;
    taxable: boolean;
    cost: string;
  };
  fieldErrors: Partial<Record<ProductFieldName, string>>;
  validation: AdminFormValidation<ProductFieldName>;
}) {
  const [price, setPrice] = useState(draft.price);
  const [cost, setCost] = useState(draft.cost);

  const priceAmount = parseMoneyInput(price);
  const costAmount = parseMoneyInput(cost);
  const profit = priceAmount != null && costAmount != null ? priceAmount - costAmount : null;
  const marginLabel = formatMargin(priceAmount, costAmount);
  const marginDisplay = marginLabel === "—" ? null : marginLabel;

  return (
    <div className="grid gap-5" data-component="ProductPriceFields">
      <AdminTextField
        label="Price"
        owner="Shopify"
        required
        name="price"
        type="number"
        min="0.01"
        step="0.01"
        inputMode="decimal"
        startAdornment="€"
        data-validation-message={PRODUCT_FIELD_MESSAGES.price}
        value={price}
        onChange={(event) => {
          setPrice(event.target.value);
          validation.clearFieldError("price");
        }}
        error={fieldErrors.price}
        errorId={validation.fieldErrorId("price")}
        {...validation.fieldProps("price")}
      />

      <AdminCollapsiblePanel title="Additional display prices" defaultOpen>
        <div className="grid gap-4">
          <AdminReadonlyField
            label="Compare-at price"
            owner="Shopify"
            value={formatCompareAtDisplay(draft.compareAt)}
            emptyLabel="Not set"
            help={(
              <AdminHelp label="Compare-at guidance">
                Struck-through original price when higher than Price. Synarava shows
                the Shopify value only — edit compare-at in Shopify Admin. Rules for
                lawful discount/reference pricing are still being confirmed.
              </AdminHelp>
            )}
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCheckboxControl
        name="taxable"
        value="1"
        label="Charge tax on this product"
        defaultChecked={draft.taxable}
      />

      <div
        className="grid gap-3 pt-4 sm:grid-cols-3"
        style={{ borderTop: "1px solid color-mix(in srgb, var(--adm-cool) 16%, var(--adm-border))" }}
      >
        <AdminTextField
          label="Cost"
          owner="Shopify"
          name="cost"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          startAdornment="€"
          value={cost}
          onChange={(event) => setCost(event.target.value)}
          help={(
            <AdminHelp label="Cost guidance">
              Shopify InventoryItem unit cost (shop currency). Used only for profit/margin — not shown on the storefront.
            </AdminHelp>
          )}
        />
        <AdminReadonlyField
          label="Profit"
          value={profit == null ? null : formatMoney(profit)}
          help={(
            <AdminHelp label="Profit guidance">
              Price minus Cost. Local calculation only — not stored in Shopify or Synarava.
            </AdminHelp>
          )}
        />
        <AdminReadonlyField
          label="Margin"
          value={marginDisplay}
          help={(
            <AdminHelp label="Margin guidance">
              Profit as a percent of Price. Local calculation only — not stored.
            </AdminHelp>
          )}
        />
      </div>
    </div>
  );
}
