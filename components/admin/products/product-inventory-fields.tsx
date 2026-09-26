"use client";

import {
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

type InventoryLevelRow = {
  locationId: string;
  locationName: string;
  unavailable: number | null;
  committed: number | null;
  available: number | null;
  onHand: number | null;
};

export type InventoryShippingFacts = {
  barcode: string | null;
  tracked: boolean | null;
  inventoryPolicy: "CONTINUE" | "DENY" | null;
  requiresShipping: boolean | null;
  weightGrams: number | null;
  countryCodeOfOrigin: string | null;
  harmonizedSystemCode: string | null;
  locations: InventoryLevelRow[];
};

function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function yesNo(value: boolean | null): string {
  if (value == null) return "—";
  return value ? "On" : "Off";
}

/**
 * Primary-variant inventory + shipping facts from local columns + last Shopify
 * snapshot (location quantities / origin / HS live on inventoryItem).
 */
export function inventoryShippingFactsFromProduct(input: {
  primaryVariant?: {
    barcode: string | null;
    tracked: boolean;
    requiresShipping: boolean;
    weightGrams: number | null;
    shopifyVariantId: string | null;
  } | null;
  shopifySnapshot: unknown;
}): InventoryShippingFacts {
  const variant = input.primaryVariant ?? null;
  const snapshot = record(input.shopifySnapshot);
  const remoteVariants = rows(snapshot.variants);
  const remote = variant?.shopifyVariantId
    ? remoteVariants.find((item) => item.id === variant.shopifyVariantId)
    : remoteVariants[0];
  const inventoryItem = record(remote?.inventoryItem);
  const inventoryLevels = rows(inventoryItem.inventoryLevels);
  const policyRaw = string(remote?.inventoryPolicy);
  const inventoryPolicy = policyRaw === "CONTINUE" || policyRaw === "DENY"
    ? policyRaw
    : null;

  return {
    barcode: variant?.barcode ?? (typeof remote?.barcode === "string" ? remote.barcode : null),
    tracked: variant?.tracked ?? (typeof inventoryItem.tracked === "boolean" ? inventoryItem.tracked : null),
    inventoryPolicy,
    requiresShipping: variant?.requiresShipping
      ?? (typeof inventoryItem.requiresShipping === "boolean" ? inventoryItem.requiresShipping : null),
    weightGrams: variant?.weightGrams
      ?? null,
    countryCodeOfOrigin: string(inventoryItem.countryCodeOfOrigin) || null,
    harmonizedSystemCode: string(inventoryItem.harmonizedSystemCode) || null,
    locations: inventoryLevels.map((level) => {
      const quantities = rows(level.quantities);
      const quantity = (name: string) => {
        const entry = quantities.find((row) => row.name === name)?.quantity;
        return typeof entry === "number" ? entry : null;
      };
      const available = quantity("available");
      const committed = quantity("committed");
      const onHand = quantity("on_hand");
      const unavailable = available != null && committed != null && onHand != null
        ? onHand - available - committed
        : null;
      const location = record(level.location);
      const locationId = string(location.id) || string(location.name) || "unknown-location";
      return {
        locationId,
        locationName: string(location.name) || `Location ${locationId.split("/").pop() ?? "—"}`,
        unavailable,
        committed,
        available,
        onHand,
      };
    }),
  };
}

/**
 * Shopify Inventory + Shipping cards for the primary variant.
 * Editable: SKU + available qty (Save / Push). Other facts are pull projections —
 * edit in Shopify Admin until Synarava write paths exist.
 */
export function ProductInventoryFields({
  draft,
  variantExists = false,
  facts,
  fieldErrors,
  validation,
}: {
  draft: { sku: string; stockOnHand: string };
  variantExists?: boolean;
  facts: InventoryShippingFacts;
  fieldErrors: Partial<Record<ProductFieldName, string>>;
  validation: AdminFormValidation<ProductFieldName>;
}) {
  const sellWhenOutOfStock = facts.inventoryPolicy == null
    ? "—"
    : facts.inventoryPolicy === "CONTINUE"
      ? "On"
      : "Off";

  return (
    <div data-component="ProductInventoryFields" className="grid gap-5">
      <AdminCollapsiblePanel title="Inventory" defaultOpen>
        <div className="grid gap-5">
          <AdminReadonlyField
            label="Inventory tracked"
            owner="Shopify"
            value={yesNo(facts.tracked)}
            help={(
              <AdminHelp label="Inventory tracked guidance">
                Synarava shows the primary variant tracking flag from the last Pull.
                Toggle tracking in Shopify Admin; Pull to refresh.
              </AdminHelp>
            )}
          />

          {facts.locations.length > 0 ? (
            <div className="overflow-x-auto">
              <p className="adm-label mb-2">Inventory by location</p>
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--adm-border)]">
                    <th className="py-2 font-medium">Location</th>
                    <th className="font-medium">Unavailable</th>
                    <th className="font-medium">Committed</th>
                    <th className="font-medium">Available</th>
                    <th className="font-medium">On hand</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.locations.map((level) => (
                    <tr key={level.locationId} className="border-b border-[var(--adm-border)]">
                      <td className="py-2">{level.locationName}</td>
                      <td>{level.unavailable ?? "—"}</td>
                      <td>{level.committed ?? "—"}</td>
                      <td>{level.available ?? "—"}</td>
                      <td>{level.onHand ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-[var(--adm-muted)]">
                Location quantities come from the last Shopify Pull. Adjust stock in Shopify or
                edit Available quantity below for the Synarava primary qty used on Push.
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--adm-muted)]">
              No location quantities yet. Link the product and Pull, or set Available quantity below.
            </p>
          )}

          <div className="grid items-start gap-x-4 gap-y-6 md:grid-cols-2">
            <AdminTextField
              label="SKU"
              owner="Shopify"
              required
              name="sku"
              data-validation-message={PRODUCT_FIELD_MESSAGES.sku}
              defaultValue={draft.sku}
              error={fieldErrors.sku}
              errorId={validation.fieldErrorId("sku")}
              {...validation.fieldProps("sku")}
            />
            <AdminTextField
              label="Available quantity"
              owner="Shopify"
              help={(
                <AdminHelp label="Inventory guidance">
                  {variantExists
                    ? "Primary variant available qty. Save locally, then Push to Shopify. Location breakdown above is Pull-only."
                    : "No variant record yet. Enter quantity and save to create the primary variant."}
                </AdminHelp>
              )}
              name="stockOnHand"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              defaultValue={draft.stockOnHand}
            />
          </div>

          <div className="grid items-start gap-x-4 gap-y-6 md:grid-cols-2">
            <AdminReadonlyField
              label="Barcode"
              owner="Shopify"
              value={facts.barcode?.trim() || "—"}
              help={(
                <AdminHelp label="Barcode guidance">
                  Edit barcode in Shopify Admin on the variant, then Pull.
                </AdminHelp>
              )}
            />
            <AdminReadonlyField
              label="Sell when out of stock"
              owner="Shopify"
              value={sellWhenOutOfStock}
              help={(
                <AdminHelp label="Sell when out of stock guidance">
                  Maps to Shopify inventory policy CONTINUE vs DENY. Change in Shopify Admin, then Pull.
                </AdminHelp>
              )}
            />
          </div>
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="Shipping" defaultOpen>
        <div className="grid gap-5 md:grid-cols-2">
          <AdminReadonlyField
            label="Physical product"
            owner="Shopify"
            value={yesNo(facts.requiresShipping)}
            help={(
              <AdminHelp label="Physical product guidance">
                Shopify “requires shipping”. Edit on the variant inventory item in Shopify Admin, then Pull.
              </AdminHelp>
            )}
          />
          <AdminReadonlyField
            label="Product weight"
            owner="Shopify"
            value={facts.weightGrams == null ? "—" : `${facts.weightGrams} g`}
            help={(
              <AdminHelp label="Weight guidance">
                Weight from the last Pull (grams). Edit in Shopify Admin, then Pull.
              </AdminHelp>
            )}
          />
          <AdminReadonlyField
            label="Country of origin"
            owner="Shopify"
            value={facts.countryCodeOfOrigin ?? "—"}
          />
          <AdminReadonlyField
            label="HS code"
            owner="Shopify"
            value={facts.harmonizedSystemCode ?? "—"}
          />
        </div>
        <p className="mt-3 text-xs text-[var(--adm-muted)]">
          Package presets are managed in Shopify Admin shipping settings — not mirrored here yet.
        </p>
      </AdminCollapsiblePanel>
    </div>
  );
}
