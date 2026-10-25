import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSyncWaterfall: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
  getLatestCatalogPresenceDifferences: vi.fn(),
}));

vi.mock("@/lib/sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sync")>("@/lib/sync");
  return {
    ...actual,
    runSyncWaterfall: mocks.runSyncWaterfall,
  };
});
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));
vi.mock("@/lib/shopify/catalog-presence-server", () => ({
  getLatestCatalogPresenceDifferences: mocks.getLatestCatalogPresenceDifferences,
}));

import {
  commerceFingerprint,
  findCatalogPresenceDifference,
  listConflictedProductIds,
  loadProductConflictFromSyncResult,
} from "@/lib/shopify/catalog-conflict";
import { emptySyncResult, type SyncLeaf } from "@/lib/sync/types";

const LOCALES = [
  { code: "en", shopifyLocale: "en", isDefault: true, name: "English", nativeName: "English" },
  { code: "pt", shopifyLocale: "pt-PT", isDefault: false, name: "Portuguese", nativeName: "Português" },
];

function presenceDiff(overrides: Record<string, unknown> = {}) {
  return {
    id: "shopify:42",
    kind: "SHOPIFY_ONLY",
    localProductId: null,
    shopifyProductId: "gid://shopify/Product/42",
    name: "Remote ring",
    handle: "remote-ring",
    sku: "R-42",
    localFingerprint: "missing",
    shopifyFingerprint: "remote-fp",
    remoteMissing: false,
    matchReason: null,
    localIdentity: null,
    shopifyIdentity: { name: "Remote ring", handle: "remote-ring", sku: "R-42" },
    ...overrides,
  };
}

function leaf(overrides: Partial<SyncLeaf> & Pick<SyncLeaf, "kind" | "fieldKey" | "label">): SyncLeaf {
  return {
    id: "leaf",
    resourceType: "PRODUCT",
    resourceId: "product-1",
    locale: null,
    synaravaValue: "local",
    shopifyValue: "remote",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    path: null,
    presenceSide: null,
    targetKind: "NATIVE",
    localFingerprint: "fp-local",
    shopifyFingerprint: "fp-shopify",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublishedStorefrontLocales.mockResolvedValue(LOCALES);
  mocks.getLatestCatalogPresenceDifferences.mockResolvedValue([]);
  mocks.runSyncWaterfall.mockResolvedValue({
    result: emptySyncResult({ state: "ready", checkedAt: "2026-10-25T00:00:00.000Z", leaves: [] }),
  });
});

describe("findCatalogPresenceDifference", () => {
  it("resolves a remapped Shopify-only row by Shopify GID", () => {
    const differences = [presenceDiff({
      id: "local-matched",
      localProductId: "local-matched",
      matchReason: "SKU",
      localIdentity: { name: "Draft", handle: "draft", sku: "R-42" },
    })];
    expect(findCatalogPresenceDifference(differences, "shopify:42")?.id).toBe("local-matched");
  });
});

describe("commerceFingerprint", () => {
  it("hashes the value with sha256 hex", () => {
    expect(commerceFingerprint("hello")).toMatch(/^[a-f0-9]{64}$/);
    expect(commerceFingerprint("hello")).toBe(commerceFingerprint("hello"));
  });
});

describe("loadProductConflictFromSyncResult", () => {
  it("maps SyncResult leaves with skipRefresh and attaches presenceDifference", async () => {
    const presence = presenceDiff();
    mocks.getLatestCatalogPresenceDifferences.mockResolvedValue([presence]);
    mocks.runSyncWaterfall.mockResolvedValue({
      result: emptySyncResult({
        state: "ready",
        checkedAt: "2026-10-25T00:00:00.000Z",
        leaves: [
          leaf({
            kind: "presence",
            fieldKey: "presence:product",
            label: "Product exists only in Shopify",
            resourceId: "shopify:42",
            presenceSide: "SHOPIFY_ONLY",
            allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
            synaravaValue: "— Product is missing —",
            shopifyValue: "Remote ring",
            localFingerprint: "missing",
            shopifyFingerprint: "remote-fp",
          }),
        ],
      }),
    });

    const result = await loadProductConflictFromSyncResult("shopify:42", {
      requestedBy: "admin",
      skipRefresh: true,
    });

    expect(mocks.runSyncWaterfall).toHaveBeenCalledWith({
      scope: { kind: "product", productId: "shopify:42" },
      requestedBy: "admin",
      skipRefresh: true,
    });
    expect(result.fields[0]).toMatchObject({
      origin: "PRESENCE",
      shopifyValue: "Remote ring · SKU R-42",
      presenceDifference: presence,
      allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
    });
  });

  it("maps commerce leaves from SyncResult without inventing a Shopify fetch", async () => {
    mocks.runSyncWaterfall.mockResolvedValue({
      result: emptySyncResult({
        state: "ready",
        checkedAt: "2026-10-25T00:00:00.000Z",
        leaves: [
          leaf({
            kind: "commerce",
            fieldKey: "commerce:name",
            label: "Name",
            path: "title",
            synaravaValue: "Local",
            shopifyValue: "Remote",
          }),
        ],
      }),
    });

    const result = await loadProductConflictFromSyncResult("product-1", {
      requestedBy: "admin",
      skipRefresh: true,
    });

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toMatchObject({
      origin: "COMMERCE",
      label: "Name",
      synaravaValue: "Local",
      shopifyValue: "Remote",
      path: "title",
    });
  });
});

describe("listConflictedProductIds", () => {
  it("derives unique PRODUCT resourceIds from SyncResult leaves", async () => {
    mocks.runSyncWaterfall.mockResolvedValue({
      result: emptySyncResult({
        state: "ready",
        checkedAt: "2026-10-25T00:00:00.000Z",
        leaves: [
          leaf({ kind: "commerce", fieldKey: "commerce:name", label: "Name", resourceId: "p1" }),
          leaf({ kind: "translation", fieldKey: "translation:pt:title", label: "Title", resourceId: "p1", locale: "pt", id: "t1" }),
          leaf({ kind: "presence", fieldKey: "presence:product", label: "x", resourceId: "shopify:42", id: "pr", presenceSide: "SHOPIFY_ONLY" }),
          leaf({
            kind: "commerce",
            fieldKey: "commerce:name",
            label: "Name",
            resourceId: "c1",
            resourceType: "COLLECTION",
            id: "c",
          }),
        ],
      }),
    });

    const result = await listConflictedProductIds();

    expect(result.sort()).toEqual(["p1", "shopify:42"]);
    expect(mocks.runSyncWaterfall).toHaveBeenCalledWith({
      scope: { kind: "catalog" },
      requestedBy: "system",
      skipRefresh: true,
    });
  });
});
