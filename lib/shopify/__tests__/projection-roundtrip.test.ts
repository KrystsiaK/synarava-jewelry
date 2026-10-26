/**
 * Round-trip invariant: Shopify snapshot → pull mapping → derive → diff === [].
 * Any non-empty diff fails the fixture and lists the path.
 */
import { describe, expect, it } from "vitest";

import { shopifyAmountToCents } from "@/lib/shopify/money";
import { diffShopifyProjections } from "@/lib/shopify/shopify-projection-diff";
import { deriveProductWindow } from "@/lib/sync/derive-window";
import { productExtrasFromShopifySnapshot } from "@/lib/sync/extras";

type Snapshot = Record<string, unknown>;

const WEIGHT_G: Record<string, number> = {
  GRAMS: 1, KILOGRAMS: 1000, OUNCES: 28.349523125, POUNDS: 453.59237,
};

/** Mirror of product-sync weightInGrams (pull path). */
function weightInGrams(weight: unknown): number | null {
  if (!weight || typeof weight !== "object") return null;
  const w = weight as { value?: number; unit?: string };
  if (w.value == null || w.value <= 0 || !w.unit) return null;
  const mult = WEIGHT_G[w.unit];
  if (mult == null) return null;
  return Math.round(w.value * mult * 10000) / 10000;
}

/**
 * Real pull mapping: snapshot → columns + extras (no DB).
 * Mirrors upsert fields in product-sync + productExtrasFromShopifySnapshot.
 */
function pullSnapshotToDeriveInput(snapshot: Snapshot) {
  const variants = Array.isArray(snapshot.variants) ? snapshot.variants : [];
  const seo = (snapshot.seo && typeof snapshot.seo === "object"
    ? snapshot.seo
    : {}) as { title?: string | null; description?: string | null };
  const category = snapshot.category && typeof snapshot.category === "object"
    ? snapshot.category as { id?: string; name?: string | null; fullName?: string | null }
    : null;

  return {
    shopifyProductId: typeof snapshot.id === "string" ? snapshot.id : null,
    name: String(snapshot.title ?? ""),
    slug: String(snapshot.handle ?? ""),
    description: typeof snapshot.descriptionHtml === "string" ? snapshot.descriptionHtml : null,
    preferredDescriptionHtml:
      typeof snapshot.descriptionHtml === "string" ? snapshot.descriptionHtml : null,
    vendor: typeof snapshot.vendor === "string" ? snapshot.vendor : null,
    productType: typeof snapshot.productType === "string" ? snapshot.productType : null,
    status: String(snapshot.status ?? "ACTIVE"),
    seoTitle: seo.title || null,
    seoDescription: seo.description || null,
    shopifyCategoryId: category?.id ?? null,
    shopifyCategoryName: category?.fullName ?? category?.name ?? null,
    tags: Array.isArray(snapshot.tags) ? snapshot.tags.map(String) : [],
    collections: Array.isArray(snapshot.collections)
      ? snapshot.collections.filter((c): c is { id: string; handle: string; title: string } =>
        Boolean(c && typeof c === "object" && typeof (c as { id?: string }).id === "string"))
      : [],
    variants: variants.map((raw) => {
      const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const inv = (v.inventoryItem && typeof v.inventoryItem === "object"
        ? v.inventoryItem
        : {}) as Record<string, unknown>;
      const unitCost = inv.unitCost && typeof inv.unitCost === "object"
        ? inv.unitCost as { amount?: string }
        : null;
      const measurement = inv.measurement && typeof inv.measurement === "object"
        ? inv.measurement as { weight?: unknown }
        : null;
      return {
        shopifyVariantId: typeof v.id === "string" ? v.id : null,
        sku: String(v.sku ?? ""),
        title: String(v.title ?? ""),
        barcode: typeof v.barcode === "string" ? v.barcode : null,
        priceCents: shopifyAmountToCents(typeof v.price === "string" ? v.price : "0"),
        compareAtCents: typeof v.compareAtPrice === "string"
          ? shopifyAmountToCents(v.compareAtPrice)
          : null,
        costCents: unitCost?.amount ? shopifyAmountToCents(unitCost.amount) : null,
        inventoryPolicy: typeof v.inventoryPolicy === "string" ? v.inventoryPolicy : "DENY",
        stockOnHand: typeof v.inventoryQuantity === "number" ? v.inventoryQuantity : 0,
        taxable: Boolean(v.taxable),
        selectedOptions: v.selectedOptions ?? [],
        shopifyInventoryItemId: typeof inv.id === "string" ? inv.id : null,
        requiresShipping: typeof inv.requiresShipping === "boolean" ? inv.requiresShipping : true,
        tracked: typeof inv.tracked === "boolean" ? inv.tracked : true,
        weightGrams: weightInGrams(measurement?.weight),
      };
    }),
    extras: productExtrasFromShopifySnapshot(snapshot),
  };
}

function assertRoundTrip(name: string, snapshot: Snapshot) {
  const derived = deriveProductWindow(pullSnapshotToDeriveInput(snapshot));
  const diffs = diffShopifyProjections(derived, snapshot);
  if (diffs.length > 0) {
    const paths = diffs.map((d) => `${d.path}: ${d.local} vs ${d.shopify}`).join("\n");
    throw new Error(`Round-trip failed for ${name}:\n${paths}`);
  }
  expect(diffs).toEqual([]);
  expect(diffs.every((d) => d.local !== d.shopify)).toBe(true);
}

const baseVariant = {
  id: "gid://shopify/ProductVariant/1",
  title: "Default Title",
  sku: "SKU-1",
  barcode: null as string | null,
  price: "5.0",
  compareAtPrice: null as string | null,
  inventoryPolicy: "DENY",
  inventoryQuantity: 2,
  taxable: true,
  selectedOptions: [{ name: "Title", value: "Default Title" }],
  inventoryItem: {
    id: "gid://shopify/InventoryItem/1",
    requiresShipping: true,
    tracked: true,
    countryCodeOfOrigin: null as string | null,
    harmonizedSystemCode: null as string | null,
    unitCost: null as { amount: string; currencyCode: string } | null,
    measurement: null as { weight: { value: number; unit: string } } | null,
  },
};

function productSnapshot(overrides: Partial<Snapshot> = {}, variantPatch: Record<string, unknown> = {}): Snapshot {
  const invPatch = (variantPatch.inventoryItem ?? {}) as Record<string, unknown>;
  const variant = {
    ...baseVariant,
    ...variantPatch,
    inventoryItem: { ...baseVariant.inventoryItem, ...invPatch },
  };
  return {
    id: "gid://shopify/Product/1",
    title: "Ring",
    handle: "ring",
    descriptionHtml: "<p>Hello</p>",
    tags: [],
    status: "ACTIVE",
    vendor: "Synarava",
    productType: "Ring",
    category: null,
    seo: { title: null, description: null },
    media: [],
    options: [{ id: "gid://shopify/ProductOption/1", name: "Title", position: 1, values: ["Default Title"] }],
    metafields: [],
    collections: [],
    publications: [],
    totalInventory: typeof overrides.totalInventory === "number" ? overrides.totalInventory : 2,
    ...overrides,
    variants: Array.isArray(overrides.variants) ? overrides.variants : [variant],
  };
}

describe("projection round-trip invariant", () => {
  it("null-heavy snapshot (optional fields null, empty arrays)", () => {
    assertRoundTrip("null-heavy", productSnapshot());
  });

  it("filled fields: money decimals, EUR cost, kg weight, json metafields, publications", () => {
    assertRoundTrip("filled", productSnapshot({
      title: "Pearl Ring\r\n ",
      descriptionHtml: "<p>Body with trailing </p>  ",
      tags: ["gold", "pearl"],
      vendor: " Synarava ",
      productType: "Ring  ",
      seo: { title: " SEO title ", description: "SEO desc\r\n" },
      category: { id: "gid://shopify/TaxonomyCategory/1", name: "Rings", fullName: "Jewelry > Rings" },
      collections: [{ id: "gid://shopify/Collection/1", handle: "all", title: "All" }],
      publications: [{
        isPublished: true,
        publishDate: "2026-01-01T00:00:00.000Z",
        publication: { id: "gid://shopify/Publication/1", name: "Online Store" },
      }],
      metafields: [
        { namespace: "custom", key: "spec", type: "json", value: "{\"a\":1}" },
        { namespace: "custom", key: "count", type: "number_integer", value: "3" },
        { namespace: "custom", key: "flag", type: "boolean", value: "true" },
        { namespace: "custom", key: "tags", type: "list.single_line_text_field", value: "[\"a\",\"b\"]" },
        { namespace: "custom", key: "empty_list", type: "list.single_line_text_field", value: "[]" },
      ],
      media: [{
        id: "gid://shopify/MediaImage/1",
        alt: " Front ",
        preview: { image: { url: "https://cdn.shopify.com/a.jpg?v=9" } },
      }],
      totalInventory: 5,
    }, {
      price: "5.0",
      compareAtPrice: "10.00",
      inventoryQuantity: 5,
      barcode: " 123 ",
      inventoryItem: {
        unitCost: { amount: "5.0", currencyCode: "EUR" },
        measurement: { weight: { value: 1, unit: "KILOGRAMS" } },
        countryCodeOfOrigin: "PT",
        harmonizedSystemCode: "7113.19",
      },
    }));
  });

  it("oz / lb weights and UNLISTED status", () => {
    assertRoundTrip("ounces", productSnapshot({}, {
      inventoryItem: { measurement: { weight: { value: 2, unit: "OUNCES" } } },
    }));
    assertRoundTrip("pounds", productSnapshot({}, {
      inventoryItem: { measurement: { weight: { value: 0.5, unit: "POUNDS" } } },
    }));
    assertRoundTrip("unlisted", productSnapshot({ status: "UNLISTED" }));
  });

  it("non-empty metafield list and CRLF text", () => {
    assertRoundTrip("crlf-text", productSnapshot({
      title: "Line\r\nTwo  ",
      descriptionHtml: "<p>Keep\r\nme</p>",
      metafields: [
        { namespace: "synarava", key: "care", type: "multi_line_text_field", value: "Dry\r\nflat  " },
      ],
    }));
  });
});
