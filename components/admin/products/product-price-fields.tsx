"use client";

import { useState } from "react";

import {
  AdminCheckboxControl,
  AdminCollapsiblePanel,
  AdminHelp,
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

/**
 * Shopify Price card projection: price, compare-at, taxable, cost.
 * Profit / margin are local calculations (not Shopify fields).
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
          <AdminTextField
            label="Compare-at price"
            owner="Shopify"
            name="compareAt"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            startAdornment="€"
            defaultValue={draft.compareAt}
            help={(
              <AdminHelp label="Compare-at guidance">
                Shown as the struck-through original price when higher than Price. Leave empty or 0 to clear in Shopify.
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
        <div className="adm-field-unit">
          <p className="adm-label">Profit</p>
          <p className="mt-2 text-sm tabular-nums text-[var(--adm-ink)]">{formatMoney(profit)}</p>
        </div>
        <div className="adm-field-unit">
          <p className="adm-label">Margin</p>
          <p className="mt-2 text-sm tabular-nums text-[var(--adm-ink)]">{formatMargin(priceAmount, costAmount)}</p>
        </div>
      </div>
    </div>
  );
}
