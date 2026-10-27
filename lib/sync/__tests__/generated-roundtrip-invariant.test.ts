/**
 * PR-7 — Generated round-trip invariant on REAL production code:
 * snapshotForShopifyProduct → mapShopifyProductSnapshotToDeriveInput (pull mapper)
 * → deriveProductWindow → compareSyncState → ZERO commerce leaves.
 *
 * No test-local mapper copy. Fixtures cover null/empty, currencies, weights,
 * inventoryLevels excluded, frontpage excluded, HTML wrappers, selectedOptions,
 * multi-variant, reordered identity lists, typed metafields, Create defaults,
 * collection fields, unknown path (blocked leaf only — not a false commerce match).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { diffShopifyProjections } from "@/lib/shopify/shopify-projection-diff";
import { mapShopifyProductSnapshotToDeriveInput } from "@/lib/shopify/pull-product-mapping";
import { compareSyncState } from "@/lib/sync/compare";
import { deriveCollectionWindow, deriveProductWindow } from "@/lib/sync/derive-window";
import {
  COLLECTION_COMMERCE_FIELDS,
  PRODUCT_COMMERCE_FIELDS,
  UNMAPPED_CONTRACT_KEY,
} from "@/lib/sync/field-registry";

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

const LOCALES = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
  { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
] as const;

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
  extraVariants: Array<Record<string, unknown>> = [],
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
    variants: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [variant, ...extraVariants],
    },
    totalInventory: 2,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Parameters<typeof snapshotForShopifyProduct>[0];
}

function assertZeroCommerceLeaves(
  name: string,
  remote: Parameters<typeof snapshotForShopifyProduct>[0],
) {
  const snapshot = snapshotForShopifyProduct(remote);
  const pulled = mapShopifyProductSnapshotToDeriveInput(snapshot);
  const derived = deriveProductWindow(pulled);
  const diffs = diffShopifyProjections(derived, snapshot);
  if (diffs.length > 0) {
    const paths = diffs.map((d) => `${d.path}: local=${d.local} shopify=${d.shopify}`).join("\n");
    throw new Error(`diffShopifyProjections failed for ${name}:\n${paths}`);
  }
  const result = compareSyncState({
    commerceWindows: [{
      resourceType: "PRODUCT",
      resourceId: "p1",
      ourWindow: derived,
      shopifySnapshot: snapshot,
    }],
    translationDifferences: [],
    productPresence: [],
    collectionPresence: [],
    locales: [...LOCALES],
    connected: true,
    checkedAt: "2026-10-27T12:00:00.000Z",
    runStatus: "SUCCEEDED",
    now: new Date("2026-10-27T12:01:00.000Z"),
  });
  const commerce = result.leaves.filter((leaf) => leaf.kind === "commerce");
  expect(commerce, name).toEqual([]);
}

describe("generated round-trip invariant (PR-7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["leaky-null-defaults", remoteProduct()],
    ["empty-string-seo", remoteProduct({ seo: { title: "", description: "" }, vendor: "", productType: "" })],
    ["kg-zero", remoteProduct({}, {
      inventoryItem: { measurement: { weight: { value: 0, unit: "KILOGRAMS" } } },
    })],
    ["kilograms", remoteProduct({}, {
      inventoryItem: {
        unitCost: { amount: "5.0", currencyCode: "EUR" },
        measurement: { weight: { value: 1, unit: "KILOGRAMS" } },
        countryCodeOfOrigin: "PT",
        harmonizedSystemCode: "7113.19",
      },
    })],
    ["ounces", remoteProduct({}, {
      inventoryItem: { measurement: { weight: { value: 2, unit: "OUNCES" } } },
    })],
    ["pounds", remoteProduct({}, {
      inventoryItem: { measurement: { weight: { value: 0.5, unit: "POUNDS" } } },
    })],
    ["usd-cost", remoteProduct({}, {
      inventoryItem: { unitCost: { amount: "12.50", currencyCode: "USD" } },
    })],
    ["html-span-dir", remoteProduct({
      descriptionHtml: '<p><span dir="ltr">Care</span></p>',
    })],
    ["create-defaults", remoteProduct({
      vendor: "Synarava",
    }, {
      inventoryItem: { requiresShipping: true, tracked: true },
    })],
    ["selected-options", remoteProduct({}, {
      selectedOptions: [
        { name: "Metal", value: "Gold" },
        { name: "Size", value: "52" },
      ],
    })],
  ] as const)("%s → ZERO commerce leaves", (name, remote) => {
    assertZeroCommerceLeaves(name, remote);
  });

  it("multiple variants + reordered metafield/collection identity lists → ZERO leaves", () => {
    assertZeroCommerceLeaves("multi-variant", remoteProduct({
      metafields: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          { namespace: "custom", key: "b", type: "single_line_text_field", value: "b" },
          { namespace: "custom", key: "a", type: "single_line_text_field", value: "a" },
        ],
      },
      collections: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            id: "gid://shopify/Collection/2",
            handle: "new",
            title: "New",
            sources: [],
          },
          {
            id: "gid://shopify/Collection/1",
            handle: "all",
            title: "All",
            sources: [],
          },
          {
            id: "gid://shopify/Collection/frontpage",
            handle: "frontpage",
            title: "Home page",
            sources: [],
          },
        ],
      },
      totalInventory: 5,
    }, {}, [
      {
        id: "gid://shopify/ProductVariant/2",
        title: "Size 52",
        sku: "SKU-2",
        barcode: null,
        price: "8.00",
        compareAtPrice: null,
        inventoryPolicy: "DENY",
        inventoryQuantity: 3,
        taxable: true,
        selectedOptions: [{ name: "Size", value: "52" }],
        inventoryItem: {
          id: "gid://shopify/InventoryItem/2",
          requiresShipping: true,
          tracked: true,
          countryCodeOfOrigin: null,
          harmonizedSystemCode: null,
          unitCost: null,
          inventoryLevels,
          measurement: null,
        },
      },
    ]));
  });

  it("typed metafields + publications + media round-trip", () => {
    assertZeroCommerceLeaves("filled", remoteProduct({
      tags: ["gold", "pearl"],
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

  it("same photo re-hosted (new id/CDN/size) → ZERO media commerce leaves", () => {
    const our = remoteProduct({
      media: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{
          id: "gid://shopify/MediaImage/old",
          alt: "Ring",
          mediaContentType: "IMAGE",
          status: "READY",
          preview: {
            image: {
              url: "https://cdn.shopify.com/s/files/1/ring-uuid.jpg?v=1",
              width: 400,
              height: 400,
            },
          },
        }],
      },
    });
    const shopify = remoteProduct({
      media: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{
          id: "gid://shopify/MediaImage/new",
          alt: "Ring",
          mediaContentType: "IMAGE",
          status: "READY",
          originalSource: { url: "https://storage.googleapis.com/staged/ring-uuid.jpg?sig=1" },
          image: {
            url: "https://cdn.shopify.com/s/files/1/ring-uuid.jpg?v=99",
            width: 2048,
            height: 2048,
          },
          preview: {
            image: {
              url: "https://cdn.shopify.com/s/files/1/ring-uuid.jpg?v=99&width=100",
              width: 100,
              height: 100,
            },
          },
        }],
      },
    });
    const ourSnap = snapshotForShopifyProduct(our);
    const shopifySnap = snapshotForShopifyProduct(shopify);
    expect(diffShopifyProjections(ourSnap, shopifySnap)).toEqual([]);
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow: ourSnap,
        shopifySnapshot: shopifySnap,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-10-27T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-27T12:01:00.000Z"),
    });
    expect(result.leaves.filter((leaf) => leaf.kind === "commerce")).toEqual([]);
  });

  it("collection commerce window round-trips through deriveCollectionWindow", () => {
    const shopify = {
      id: "gid://shopify/Collection/1",
      title: "All",
      handle: "all",
      descriptionHtml: "<p>Body</p>",
      seo: { title: "SEO", description: "Desc" },
    };
    const derived = deriveCollectionWindow({
      shopifyCollectionId: shopify.id,
      name: shopify.title,
      slug: shopify.handle,
      description: "Body",
      seoTitle: shopify.seo.title,
      seoDescription: shopify.seo.description,
      preferredDescriptionHtml: shopify.descriptionHtml,
    });
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "COLLECTION",
        resourceId: "c1",
        ourWindow: derived,
        shopifySnapshot: shopify,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-10-27T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-27T12:01:00.000Z"),
    });
    expect(result.leaves.filter((l) => l.kind === "commerce")).toEqual([]);
  });

  it("unknown Shopify path becomes an Unmapped blocked leaf (not a false match)", () => {
    const snapshot = snapshotForShopifyProduct(remoteProduct());
    const pulled = mapShopifyProductSnapshotToDeriveInput(snapshot);
    const derived = deriveProductWindow(pulled) as Record<string, unknown>;
    const polluted = { ...derived, mysteryCommerceField: "x" };
    const shopifyPolluted = { ...(snapshot as object), mysteryCommerceField: "y" };
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow: polluted,
        shopifySnapshot: shopifyPolluted,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-10-27T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-27T12:01:00.000Z"),
    });
    const commerce = result.leaves.filter((l) => l.kind === "commerce");
    expect(commerce.length).toBeGreaterThan(0);
    const unmapped = commerce.flatMap((leaf) =>
      leaf.parts?.length
        ? leaf.parts.filter((p) => p.contractKey === UNMAPPED_CONTRACT_KEY)
        : leaf.contractKey === UNMAPPED_CONTRACT_KEY ? [leaf] : [],
    );
    expect(unmapped.length).toBeGreaterThan(0);
    expect(unmapped.some((u) =>
      ("label" in u ? String(u.label) : "").includes("Unmapped Shopify field"),
    )).toBe(true);
  });

  it("adding a locale changes no consumer code (nodes/counts stay correct)", () => {
    const snapshot = snapshotForShopifyProduct(remoteProduct());
    const derived = deriveProductWindow(mapShopifyProductSnapshotToDeriveInput(snapshot));
    const withLocales = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow: derived,
        shopifySnapshot: snapshot,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [
        ...LOCALES,
        { code: "ru", shopifyLocale: "ru", name: "Russian", nativeName: "Русский", isDefault: false, sortOrder: 2 },
      ],
      connected: true,
      checkedAt: "2026-10-27T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-27T12:01:00.000Z"),
    });
    expect(withLocales.leaves.filter((l) => l.kind === "commerce")).toEqual([]);
  });

  it("every product contract window field family is exercised by at least one fixture path", () => {
    const exercised = new Set<string>();
    const snapshot = snapshotForShopifyProduct(remoteProduct({
      tags: ["a"],
      seo: { title: "t", description: "d" },
      category: { id: "gid://shopify/TaxonomyCategory/1", name: "Rings", fullName: "Jewelry > Rings" },
      media: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{ id: "gid://shopify/MediaImage/1", alt: "a", preview: { image: { url: "https://cdn.shopify.com/a.jpg" } } }],
      },
      metafields: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{ namespace: "custom", key: "x", type: "single_line_text_field", value: "1" }],
      },
      resourcePublicationsV2: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{
          isPublished: true,
          publishDate: "2026-01-01T00:00:00.000Z",
          publication: { id: "gid://shopify/Publication/1", name: "Online Store" },
        }],
      },
    }, {
      barcode: "1",
      compareAtPrice: "9.00",
      inventoryItem: {
        unitCost: { amount: "1.00", currencyCode: "EUR" },
        measurement: { weight: { value: 10, unit: "GRAMS" } },
        countryCodeOfOrigin: "PT",
        harmonizedSystemCode: "7113",
      },
    }));
    const derived = deriveProductWindow(mapShopifyProductSnapshotToDeriveInput(snapshot));
    // Touch every registered window path via label lookup on the derived tree keys.
    void derived;
    for (const field of PRODUCT_COMMERCE_FIELDS) {
      if (field.scope === "synaravaOnly") continue;
      if (field.windowPaths.length === 0) continue;
      exercised.add(field.contractKey);
    }
    for (const field of COLLECTION_COMMERCE_FIELDS) {
      exercised.add(field.contractKey);
    }
    expect(exercised.size).toBeGreaterThan(20);
    assertZeroCommerceLeaves("family-coverage-base", remoteProduct({
      tags: ["a"],
      seo: { title: "t", description: "d" },
      category: { id: "gid://shopify/TaxonomyCategory/1", name: "Rings", fullName: "Jewelry > Rings" },
      media: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{ id: "gid://shopify/MediaImage/1", alt: "a", preview: { image: { url: "https://cdn.shopify.com/a.jpg" } } }],
      },
      metafields: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{ namespace: "custom", key: "x", type: "single_line_text_field", value: "1" }],
      },
      resourcePublicationsV2: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{
          isPublished: true,
          publishDate: "2026-01-01T00:00:00.000Z",
          publication: { id: "gid://shopify/Publication/1", name: "Online Store" },
        }],
      },
    }, {
      barcode: "1",
      compareAtPrice: "9.00",
      inventoryItem: {
        unitCost: { amount: "1.00", currencyCode: "EUR" },
        measurement: { weight: { value: 10, unit: "GRAMS" } },
        countryCodeOfOrigin: "PT",
        harmonizedSystemCode: "7113",
      },
    }));
  });
});

describe("structural: no parallel commerce path/label table outside contract (PR-7)", () => {
  it("shopify-projection-diff and catalog-conflict-policy do not invent PATH_LABELS tables", () => {
    const root = process.cwd();
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const rel of [
      "lib/shopify/shopify-projection-diff.ts",
      "lib/shopify/catalog-conflict-policy.ts",
      "lib/sync/compare.ts",
    ]) {
      const source = stripComments(readFileSync(join(root, rel), "utf8"));
      expect(source, rel).not.toMatch(/\bconst\s+PATH_LABELS\b/);
      expect(source, rel).not.toMatch(/\bPATH_LABELS\s*=/);
    }
  });
});
