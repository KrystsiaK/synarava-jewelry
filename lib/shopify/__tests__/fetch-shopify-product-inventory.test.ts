import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SV-66 PR3: inventoryLevels enrichment is gated once on fetch purpose.
 * Snapshot/inspect/refresh skip the extra Admin round-trips; Pull keeps them
 * for stockOnHand. Compare windows never carry inventoryLevels either way.
 */

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
  fetchInventoryLevels: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { SHOPIFY_LOCATION_ID: "gid://shopify/Location/1" } }));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyNumericId: (value: unknown) =>
    String(value).startsWith("gid://") ? String(value) : `gid://shopify/Product/${value}`,
}));
vi.mock("@/lib/shopify/inventory-levels", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shopify/inventory-levels")>(
    "@/lib/shopify/inventory-levels",
  );
  return {
    ...actual,
    fetchInventoryLevels: mocks.fetchInventoryLevels,
  };
});
vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    productVariant: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    productSyncEvent: { update: vi.fn() },
  },
}));

import {
  fetchShopifyProduct,
  snapshotForShopifyProduct,
} from "../product-sync";
import { diffShopifyProjections } from "../shopify-projection-diff";

const LEVELS = [{
  location: { id: "gid://shopify/Location/1", name: "Shop" },
  quantities: [
    { name: "available", quantity: 7 },
    { name: "committed", quantity: 0 },
    { name: "on_hand", quantity: 7 },
  ],
}];

function remoteWithTrackedInventory() {
  return {
    id: "gid://shopify/Product/99",
    title: "Tracked ring",
    handle: "tracked-ring",
    descriptionHtml: "<p>x</p>",
    vendor: "Synarava",
    productType: "Ring",
    tags: [],
    status: "ACTIVE" as const,
    updatedAt: "2026-10-23T12:00:00Z",
    totalInventory: 7,
    category: null,
    seo: { title: null, description: null },
    media: { nodes: [] },
    options: [],
    collections: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    resourcePublicationsV2: {
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    featuredMedia: null,
    variants: {
      nodes: [{
        id: "gid://shopify/ProductVariant/1",
        title: "Default",
        sku: "SKU-1",
        barcode: null,
        price: "100.00",
        compareAtPrice: null,
        inventoryPolicy: "DENY",
        inventoryQuantity: 7,
        taxable: true,
        selectedOptions: [{ name: "Title", value: "Default" }],
        inventoryItem: {
          id: "gid://shopify/InventoryItem/1",
          requiresShipping: true,
          tracked: true,
          countryCodeOfOrigin: null,
          harmonizedSystemCode: null,
          unitCost: null,
          measurement: null,
        },
      }],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    metafields: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  };
}

describe("fetchShopifyProduct inventory gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shopifyAdminRequest.mockResolvedValue({ product: remoteWithTrackedInventory() });
    mocks.fetchInventoryLevels.mockResolvedValue(LEVELS);
  });

  it("snapshot purpose (default) skips fetchInventoryLevels", async () => {
    const product = await fetchShopifyProduct("99");
    expect(mocks.fetchInventoryLevels).not.toHaveBeenCalled();
    expect(product?.variants.nodes[0]?.inventoryItem).not.toHaveProperty("inventoryLevels");
  });

  it("explicit snapshot purpose skips fetchInventoryLevels", async () => {
    await fetchShopifyProduct("99", "snapshot");
    expect(mocks.fetchInventoryLevels).not.toHaveBeenCalled();
  });

  it("pull purpose fetches inventory levels for tracked variants", async () => {
    const product = await fetchShopifyProduct("99", "pull");
    expect(mocks.fetchInventoryLevels).toHaveBeenCalledTimes(1);
    expect(mocks.fetchInventoryLevels).toHaveBeenCalledWith("gid://shopify/InventoryItem/1");
    expect(product?.variants.nodes[0]?.inventoryItem?.inventoryLevels).toEqual(LEVELS);
  });

  it("compare windows match with or without levels (inventoryLevels stripped)", async () => {
    const without = await fetchShopifyProduct("99", "snapshot");
    const withLevels = await fetchShopifyProduct("99", "pull");
    expect(without).not.toBeNull();
    expect(withLevels).not.toBeNull();
    const snapA = snapshotForShopifyProduct(without!);
    const snapB = snapshotForShopifyProduct(withLevels!);
    expect(diffShopifyProjections(snapA, snapB)).toEqual([]);
    const inv = (snapB as { variants?: Array<{ inventoryItem?: object }> }).variants?.[0]?.inventoryItem;
    expect(inv).not.toHaveProperty("inventoryLevels");
  });
});

describe("fetch purpose call-site gate", () => {
  const source = readFileSync(join(process.cwd(), "lib/shopify/product-sync.ts"), "utf8");

  function extractFunction(name: string): string {
    const start = source.search(new RegExp(`(?:export\\s+)?async function ${name}\\s*\\(`));
    if (start < 0) throw new Error(`Function ${name} not found`);
    const paramOpen = source.indexOf("(", start);
    let depth = 0;
    let paramClose = -1;
    for (let i = paramOpen; i < source.length; i += 1) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          paramClose = i;
          break;
        }
      }
    }
    const braceStart = source.indexOf("{", paramClose);
    depth = 0;
    for (let i = braceStart; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) return source.slice(start, i + 1);
      }
    }
    throw new Error(`Unbalanced braces for ${name}`);
  }

  it("Pull is the only path that requests inventory enrichment", () => {
    expect(extractFunction("applyShopifyProductToSynarava")).toMatch(
      /fetchShopifyProduct\([^,]+,\s*["']pull["']\)/,
    );
    expect(extractFunction("refreshShopifyProductState")).not.toMatch(/["']pull["']/);
    expect(extractFunction("inspectProductSyncState")).not.toMatch(/["']pull["']/);
  });
});
