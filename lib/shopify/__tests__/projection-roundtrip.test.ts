/**
 * Round-trip: snapshotForShopifyProduct → pull mapping → derive → diff === [].
 * Fixtures include inventoryLevels, KILOGRAMS 0, unitCost null, frontpage, "5.0", empty arrays, kg/oz/lb.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { shopifyAmountToCents } from "@/lib/shopify/money";
import { weightInGrams } from "@/lib/shopify/commerce-mirror-shape";
import { diffShopifyProjections } from "@/lib/shopify/shopify-projection-diff";
import { deriveProductWindow } from "@/lib/sync/derive-window";
import { productExtrasFromShopifySnapshot } from "@/lib/sync/extras";

vi.mock("@/lib/env", () => ({ env: { SHOPIFY_LOCATION_ID: undefined } }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: vi.fn(),
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyNumericId: (v: unknown) => String(v),
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: vi.fn(async () => []),
}));

import { snapshotForShopifyProduct } from "@/lib/shopify/product-sync";

type Snapshot = Record<string, unknown>;

/** Snapshot money may be string or number after canonicalize. */
function moneyToCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === "string") return shopifyAmountToCents(value);
  return 0;
}

/** Pull mapping: mapped snapshot → columns + extras (mirrors product-sync upsert). */
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
        ? inv.measurement as { weight?: { value: number; unit: "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS" } }
        : null;
      return {
        shopifyVariantId: typeof v.id === "string" ? v.id : null,
        sku: String(v.sku ?? ""),
        title: String(v.title ?? ""),
        barcode: typeof v.barcode === "string" ? v.barcode : null,
        priceCents: moneyToCents(v.price),
        compareAtCents: v.compareAtPrice == null ? null : moneyToCents(v.compareAtPrice),
        costCents: unitCost?.amount != null ? moneyToCents(unitCost.amount) : null,
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

function assertRoundTrip(name: string, remote: Parameters<typeof snapshotForShopifyProduct>[0]) {
  const snapshot = snapshotForShopifyProduct(remote) as Snapshot;
  const derived = deriveProductWindow(pullSnapshotToDeriveInput(snapshot));
  const diffs = diffShopifyProjections(derived, snapshot);
  if (diffs.length > 0) {
    const paths = diffs.map((d) => `${d.path}: ${d.local} vs ${d.shopify}`).join("\n");
    throw new Error(`Round-trip failed for ${name}:\n${paths}`);
  }
  expect(diffs).toEqual([]);
  // Mapper must never keep inventoryLevels or collection sources.
  const variants = Array.isArray(snapshot.variants) ? snapshot.variants : [];
  for (const v of variants) {
    const inv = v && typeof v === "object" ? (v as { inventoryItem?: Record<string, unknown> }).inventoryItem : null;
    expect(inv).not.toHaveProperty("inventoryLevels");
  }
  const collections = Array.isArray(snapshot.collections) ? snapshot.collections : [];
  for (const c of collections) {
    expect(c).not.toHaveProperty("sources");
    expect((c as { handle?: string }).handle).not.toBe("frontpage");
  }
}

const inventoryLevels = [{
  location: { id: "gid://shopify/Location/1", name: "Shop" },
  quantities: [
    { name: "available", quantity: 2 },
    { name: "on_hand", quantity: 2 },
  ],
}];

function remoteProduct(
  overrides: Record<string, unknown> = {},
  variantPatch: Record<string, unknown> = {},
) {
  const invPatch = (variantPatch.inventoryItem ?? {}) as Record<string, unknown>;
  const inventoryItem = {
    id: "gid://shopify/InventoryItem/1",
    requiresShipping: true,
    tracked: true,
    countryCodeOfOrigin: null as string | null,
    harmonizedSystemCode: null as string | null,
    unitCost: null as { amount: string; currencyCode: string } | null,
    inventoryLevels,
    measurement: null as { weight: { value: number; unit: "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS" } } | null,
    ...invPatch,
  };
  const variant = {
    id: "gid://shopify/ProductVariant/1",
    title: "Default Title",
    sku: "SKU-1",
    barcode: null as string | null,
    price: "5.0",
    compareAtPrice: null as string | null,
    inventoryPolicy: "DENY" as const,
    inventoryQuantity: 2,
    taxable: true,
    selectedOptions: [{ name: "Title", value: "Default Title" }],
    ...variantPatch,
    inventoryItem,
  };
  return {
    id: "gid://shopify/Product/1",
    title: "Ring",
    handle: "ring",
    descriptionHtml: "<p>Hello</p>",
    tags: [] as string[],
    status: "ACTIVE",
    vendor: "Synarava",
    productType: "Ring",
    category: null,
    seo: { title: null, description: null },
    media: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
    options: [{ id: "gid://shopify/ProductOption/1", name: "Title", position: 1, values: ["Default Title"] }],
    metafields: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
    collections: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [
        {
          id: "gid://shopify/Collection/frontpage",
          handle: "frontpage",
          title: "Home page",
          sources: [{ __typename: "CollectionPublicationsSource", id: "s0", title: "sys" }],
        },
        {
          id: "gid://shopify/Collection/1",
          handle: "all",
          title: "All",
          sources: [{
            __typename: "CollectionConditionsSource",
            id: "s1",
            title: "Synarava manual membership",
            targetType: "PRODUCTS" as const,
          }],
        },
      ],
    },
    resourcePublicationsV2: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
    variants: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [variant] },
    totalInventory: 2,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Parameters<typeof snapshotForShopifyProduct>[0];
}

describe("projection round-trip invariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaky remote (inventoryLevels, frontpage, unitCost null, empty arrays) round-trips", () => {
    assertRoundTrip("leaky-null", remoteProduct());
  });

  it("KILOGRAMS 0 weight is omitted; positive kg/oz/lb convert", () => {
    assertRoundTrip("kg-zero", remoteProduct({}, {
      inventoryItem: { measurement: { weight: { value: 0, unit: "KILOGRAMS" } } },
    }));
    assertRoundTrip("kilograms", remoteProduct({}, {
      inventoryItem: {
        unitCost: { amount: "5.0", currencyCode: "EUR" },
        measurement: { weight: { value: 1, unit: "KILOGRAMS" } },
        countryCodeOfOrigin: "PT",
        harmonizedSystemCode: "7113.19",
      },
    }));
    assertRoundTrip("ounces", remoteProduct({}, {
      inventoryItem: { measurement: { weight: { value: 2, unit: "OUNCES" } } },
    }));
    assertRoundTrip("pounds", remoteProduct({}, {
      inventoryItem: { measurement: { weight: { value: 0.5, unit: "POUNDS" } } },
    }));
  });

  it("filled remote: decimals, metafields, publications, media", () => {
    assertRoundTrip("filled", remoteProduct({
      title: "Pearl Ring\r\n ",
      descriptionHtml: "<p>Body with trailing </p>  ",
      tags: ["gold", "pearl"],
      vendor: " Synarava ",
      productType: "Ring  ",
      seo: { title: " SEO title ", description: "SEO desc\r\n" },
      category: { id: "gid://shopify/TaxonomyCategory/1", name: "Rings", fullName: "Jewelry > Rings" },
      media: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{
          id: "gid://shopify/MediaImage/1",
          alt: " Front ",
          preview: { image: { url: "https://cdn.shopify.com/a.jpg?v=9" } },
        }],
      },
      metafields: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          { namespace: "custom", key: "spec", type: "json", value: "{\"a\":1}" },
          { namespace: "custom", key: "count", type: "number_integer", value: "3" },
          { namespace: "custom", key: "flag", type: "boolean", value: "true" },
          { namespace: "custom", key: "tags", type: "list.single_line_text_field", value: "[\"a\",\"b\"]" },
          { namespace: "custom", key: "empty_list", type: "list.single_line_text_field", value: "[]" },
        ],
      },
      resourcePublicationsV2: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{
          isPublished: true,
          publishDate: "2026-01-01T00:00:00.000Z",
          publication: { id: "gid://shopify/Publication/1", name: "Online Store" },
        }],
      },
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
        inventoryLevels,
      },
    }));
  });

  it("UNLISTED status and CRLF text", () => {
    assertRoundTrip("unlisted", remoteProduct({ status: "UNLISTED" }));
    assertRoundTrip("crlf-text", remoteProduct({
      title: "Line\r\nTwo  ",
      descriptionHtml: "<p>Keep\r\nme</p>",
      metafields: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          { namespace: "synarava", key: "care", type: "multi_line_text_field", value: "Dry\r\nflat  " },
        ],
      },
    }));
  });
});
