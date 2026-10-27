import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  productFindMany: vi.fn(),
  collectionFindMany: vi.fn(),
  differences: vi.fn(),
  productPresence: vi.fn(),
  collectionPresence: vi.fn(),
  locales: vi.fn(),
  latestRun: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    product: { findMany: mocks.productFindMany },
    collection: { findMany: mocks.collectionFindMany },
  },
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getStorefrontLocales: mocks.locales,
}));
vi.mock("@/lib/shopify/admin", () => ({ hasShopifyAdminConfig: () => true }));
vi.mock("@/lib/shopify/catalog-presence-server", () => ({
  getLatestCatalogPresenceDifferences: mocks.productPresence,
}));
vi.mock("@/lib/shopify/collection-presence-server", () => ({
  getLatestCollectionPresenceDifferences: mocks.collectionPresence,
}));
vi.mock("@/lib/shopify/catalog-conflict-review", () => ({
  listUnseenIncomingProductUpdates: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/shopify/reconciliation-run", () => ({
  getLatestReconcileDifferences: mocks.differences,
  getLatestReconcileRun: mocks.latestRun,
}));

import { compareSyncState } from "@/lib/sync/compare";
import { readSynaravaStateForCompare } from "@/lib/sync/read-synarava-state";
import { selectSyncCounts } from "@/lib/sync/select";

const translations = ["en", "pt-PT", "ru"].map((locale, index) => ({
  id: `difference-${locale}`,
  rootEntityType: "PRODUCT",
  rootEntityId: "product-1",
  locale,
  fieldKey: "title",
  fieldLabel: "Title",
  kind: "CONFLICT",
  localValue: `Local ${locale}`,
  shopifyValue: `Remote ${locale}`,
  localFingerprint: `local-${index}`,
  shopifyFingerprint: `remote-${index}`,
  targetKind: "NATIVE",
}));

const presence = [{
  id: "product-1",
  kind: "SYNARAVA_ONLY",
  localProductId: "product-1",
  shopifyProductId: null,
  name: "test new 4",
  handle: "test-new-4",
  sku: "BA-CH-002",
  localFingerprint: "local-presence",
  shopifyFingerprint: "missing",
  remoteMissing: false,
  matchReason: null,
  localIdentity: { name: "test new 4", handle: "test-new-4", sku: "BA-CH-002" },
  shopifyIdentity: null,
}];

describe("readSynaravaStateForCompare presence precedence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindMany.mockResolvedValue([]);
    mocks.collectionFindMany.mockResolvedValue([]);
    mocks.differences.mockResolvedValue(translations);
    mocks.productPresence.mockResolvedValue(presence);
    mocks.collectionPresence.mockResolvedValue([]);
    mocks.locales.mockResolvedValue([
      { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
      { code: "ru", shopifyLocale: "ru", name: "Russian", nativeName: "Русский", isDefault: false, sortOrder: 2 },
    ]);
    mocks.latestRun.mockResolvedValue({
      status: "SUCCEEDED",
      trigger: "MANUAL",
      completedAt: "2026-10-27T10:00:00.000Z",
    });
  });

  it.each([
    ["without a pending SKU reservation", null],
    ["with a pending SKU reservation", {
      skuAssignmentPendings: {
        "variant-1": { reservationId: "res-1", sku: "BA-CH-002" },
      },
    }],
  ])("returns one base presence leaf %s", async (_label, pendingDetails) => {
    // Pending details belong to the local product row and must not create a
    // third sync state or alter presence/locale conflict inventory.
    mocks.productPresence.mockResolvedValue([
      { ...presence[0], details: pendingDetails },
    ]);

    const input = await readSynaravaStateForCompare({ kind: "catalog" });
    const result = compareSyncState({ ...input, now: new Date("2026-10-27T10:01:00.000Z") });

    expect(result.leaves).toHaveLength(1);
    expect(result.leaves[0]).toMatchObject({
      resourceId: "product-1",
      kind: "presence",
      locale: null,
      node: "base",
    });
    expect(selectSyncCounts(result, {
      kind: "editorBanner",
      resourceType: "PRODUCT",
      resourceId: "product-1",
    })).toBe(1);
    for (const locale of ["pt", "ru"]) {
      expect(selectSyncCounts(result, {
        kind: "localeTab",
        resourceType: "PRODUCT",
        resourceId: "product-1",
        locale,
      })).toBe(0);
    }
  });
});
