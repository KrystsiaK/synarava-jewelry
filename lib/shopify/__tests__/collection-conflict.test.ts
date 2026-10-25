import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSyncWaterfall: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
  getLatestCollectionPresenceDifferences: vi.fn(),
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
vi.mock("@/lib/shopify/collection-presence-server", () => ({
  getLatestCollectionPresenceDifferences: mocks.getLatestCollectionPresenceDifferences,
}));

import {
  listConflictedCollectionIds,
  loadCollectionConflictFromSyncResult,
} from "@/lib/shopify/collection-conflict";
import { emptySyncResult, type SyncLeaf } from "@/lib/sync/types";

const locales = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
  { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
];

function leaf(overrides: Partial<SyncLeaf> & Pick<SyncLeaf, "kind" | "fieldKey" | "label">): SyncLeaf {
  return {
    id: "leaf",
    resourceType: "COLLECTION",
    resourceId: "collection-1",
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
  mocks.getPublishedStorefrontLocales.mockResolvedValue(locales);
  mocks.getLatestCollectionPresenceDifferences.mockResolvedValue([]);
  mocks.runSyncWaterfall.mockResolvedValue({
    result: emptySyncResult({ state: "ready", checkedAt: "2026-10-25T00:00:00.000Z", leaves: [] }),
  });
});

describe("loadCollectionConflictFromSyncResult", () => {
  it("maps SyncResult leaves with skipRefresh", async () => {
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
            synaravaValue: "Pets",
            shopifyValue: "Pets & Animals",
          }),
        ],
      }),
    });

    const result = await loadCollectionConflictFromSyncResult("collection-1", {
      requestedBy: "admin",
      skipRefresh: true,
    });

    expect(mocks.runSyncWaterfall).toHaveBeenCalledWith({
      scope: { kind: "collection", collectionId: "collection-1" },
      requestedBy: "admin",
      skipRefresh: true,
    });
    expect(result.fields[0]).toMatchObject({
      origin: "COMMERCE",
      label: "Name",
      synaravaValue: "Pets",
      shopifyValue: "Pets & Animals",
    });
  });

  it("attaches collection presenceDifference when present", async () => {
    const presence = {
      id: "collection-1",
      kind: "SYNARAVA_ONLY" as const,
      localProductId: "collection-1",
      shopifyProductId: null,
      name: "Local only",
      handle: "local",
      sku: "",
      localFingerprint: "local",
      shopifyFingerprint: "missing",
      remoteMissing: false,
      matchReason: null,
      localIdentity: { name: "Local only", handle: "local", sku: "" },
      shopifyIdentity: null,
    };
    mocks.getLatestCollectionPresenceDifferences.mockResolvedValue([presence]);
    mocks.runSyncWaterfall.mockResolvedValue({
      result: emptySyncResult({
        state: "ready",
        checkedAt: "2026-10-25T00:00:00.000Z",
        leaves: [
          leaf({
            kind: "presence",
            fieldKey: "presence:collection",
            label: "Collection exists only in Synarava",
            presenceSide: "SYNARAVA_ONLY",
            allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
          }),
        ],
      }),
    });

    const result = await loadCollectionConflictFromSyncResult("collection-1", {
      requestedBy: "admin",
      skipRefresh: true,
    });

    expect(result.fields[0]).toMatchObject({
      origin: "PRESENCE",
      presenceDifference: presence,
      allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    });
  });
});

describe("listConflictedCollectionIds", () => {
  it("derives unique COLLECTION resourceIds from SyncResult leaves", async () => {
    mocks.runSyncWaterfall.mockResolvedValue({
      result: emptySyncResult({
        state: "ready",
        checkedAt: "2026-10-25T00:00:00.000Z",
        leaves: [
          leaf({ kind: "commerce", fieldKey: "commerce:name", label: "Name", resourceId: "c1" }),
          leaf({ kind: "presence", fieldKey: "presence:collection", label: "x", resourceId: "shopify-collection:42", id: "pr", presenceSide: "SHOPIFY_ONLY" }),
          leaf({
            kind: "commerce",
            fieldKey: "commerce:name",
            label: "Name",
            resourceId: "p1",
            resourceType: "PRODUCT",
            id: "p",
          }),
        ],
      }),
    });

    await expect(listConflictedCollectionIds()).resolves.toEqual([
      "c1",
      "shopify-collection:42",
    ]);
    expect(mocks.runSyncWaterfall).toHaveBeenCalledWith({
      scope: { kind: "collections" },
      requestedBy: "system",
      skipRefresh: true,
    });
  });
});
