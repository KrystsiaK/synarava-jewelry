import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCollectionConflictFromSyncResult: vi.fn(),
  listConflictedCollectionIds: vi.fn(),
  applyReconcileChoice: vi.fn(),
  applyCollectionPresenceDifference: vi.fn(),
  scanAndSaveCollectionPresence: vi.fn(),
  applyCollectionCommerceField: vi.fn(),
  applyShopifyCollectionToSynarava: vi.fn(),
  findUniqueCollection: vi.fn(),
}));

vi.mock("@/lib/shopify/collection-conflict", () => ({
  loadCollectionConflictFromSyncResult: mocks.loadCollectionConflictFromSyncResult,
  listConflictedCollectionIds: mocks.listConflictedCollectionIds,
}));

vi.mock("@/lib/shopify/reconciliation-apply", () => ({
  applyReconcileChoice: mocks.applyReconcileChoice,
}));

vi.mock("@/lib/shopify/collection-presence-server", () => ({
  applyCollectionPresenceDifference: mocks.applyCollectionPresenceDifference,
  scanAndSaveCollectionPresence: mocks.scanAndSaveCollectionPresence,
  applyShopifyCollectionToSynarava: mocks.applyShopifyCollectionToSynarava,
}));
vi.mock("@/lib/shopify/collection-commerce-field-apply", () => ({
  applyCollectionCommerceField: mocks.applyCollectionCommerceField,
  isScopedCollectionCommerceFieldLabel: (label: string) =>
    ["Name", "Handle", "Description", "SEO title", "SEO description"].includes(label),
}));
vi.mock("@/lib/db", () => ({
  db: {
    collection: { findUnique: mocks.findUniqueCollection },
  },
}));

import {
  applyCollectionConflictResolution,
  previewCollectionConflictResolution,
} from "@/lib/shopify/collection-conflict-apply";
import type { CatalogConflictField } from "@/lib/shopify/catalog-conflict";

function field(overrides: Partial<CatalogConflictField> = {}): CatalogConflictField {
  return {
    fieldKey: "translation:pt-PT:title",
    label: "Title",
    scope: { kind: "LOCALE", code: "pt", name: "Portuguese", nativeName: "Português" },
    origin: "TRANSLATION",
    targetKind: "NATIVE",
    synaravaValue: "Local",
    shopifyValue: "Remote",
    localFingerprint: "local-fp",
    shopifyFingerprint: "shopify-fp",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: "div-1",
    ...overrides,
  };
}

function presenceField(overrides: Partial<CatalogConflictField> = {}): CatalogConflictField {
  return field({
    fieldKey: "presence:collection",
    label: "Collection exists only in Shopify",
    scope: { kind: "SHARED" },
    origin: "PRESENCE",
    synaravaValue: "— Collection is missing —",
    shopifyValue: "Remote kits · /remote-kits",
    localFingerprint: "missing",
    shopifyFingerprint: "remote",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
    sourceId: null,
    presenceDifference: {
      id: "shopify-collection:42",
      kind: "SHOPIFY_ONLY",
      localProductId: null,
      shopifyProductId: "gid://shopify/Collection/42",
      name: "Remote kits",
      handle: "remote-kits",
      sku: "",
      localFingerprint: "missing",
      shopifyFingerprint: "remote",
      remoteMissing: false,
      matchReason: null,
      localIdentity: null,
      shopifyIdentity: { name: "Remote kits", handle: "remote-kits", sku: "" },
    },
    ...overrides,
  });
}

function commerceField(overrides: Partial<CatalogConflictField> = {}): CatalogConflictField {
  return field({
    fieldKey: "commerce:name",
    label: "Name",
    scope: { kind: "SHARED" },
    origin: "COMMERCE",
    synaravaValue: "Local name",
    shopifyValue: "Shopify name",
    localFingerprint: "commerce-local-fp",
    shopifyFingerprint: "commerce-shopify-fp",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    sourceId: null,
    path: "title",
    ...overrides,
  });
}

function adoptShopifyField(overrides: Partial<CatalogConflictField> = {}): CatalogConflictField {
  return commerceField({
    fieldKey: "commerce:adopt-shopify",
    label: "Adopt Shopify",
    synaravaValue: "— No Synarava commerce window —",
    shopifyValue: "Shopify name · /shopify-handle",
    localFingerprint: "adopt-local",
    shopifyFingerprint: "adopt-shopify",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
    path: "_adopt",
    ...overrides,
  });
}

function conflict(fields: CatalogConflictField[], collectionId = "collection-1") {
  return { collectionId, fields };
}

describe("previewCollectionConflictResolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes supported translation fields for a collection direction", async () => {
    mocks.loadCollectionConflictFromSyncResult.mockResolvedValue(conflict([field()]));
    const preview = await previewCollectionConflictResolution({
      kind: "COLLECTION",
      collectionId: "collection-1",
      direction: "SHOPIFY_TO_SYNARAVA",
    });
    expect(preview.entries).toHaveLength(1);
    expect(preview.entries[0]).toMatchObject({
      collectionId: "collection-1",
      direction: "SHOPIFY_TO_SYNARAVA",
      willClearNonEmptyValue: false,
    });
  });

  it("bulk-previews only conflicted collections", async () => {
    mocks.listConflictedCollectionIds.mockResolvedValue(["collection-1", "collection-2"]);
    mocks.loadCollectionConflictFromSyncResult.mockImplementation(async (collectionId: string) =>
      conflict([field({ fieldKey: `translation:pt-PT:title:${collectionId}` })], collectionId),
    );
    const preview = await previewCollectionConflictResolution({
      kind: "BULK",
      direction: "SYNARAVA_TO_SHOPIFY",
    });
    expect(preview.entries).toHaveLength(2);
    expect(mocks.loadCollectionConflictFromSyncResult).toHaveBeenCalledTimes(2);
  });

  it("excludes the impossible presence direction for Shopify-only collections", async () => {
    mocks.loadCollectionConflictFromSyncResult.mockResolvedValue(conflict([presenceField()], "shopify-collection:42"));
    const preview = await previewCollectionConflictResolution({
      kind: "COLLECTION",
      collectionId: "shopify-collection:42",
      direction: "SYNARAVA_TO_SHOPIFY",
    });
    expect(preview.entries).toHaveLength(0);
    expect(preview.excluded[0]?.reason).toMatch(/only exists in Shopify/i);
  });

  it("includes Shopify direction for Synarava-only as a delete that needs confirmation", async () => {
    const presence = presenceField({
      allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
      presenceDifference: {
        id: "local-7",
        kind: "SYNARAVA_ONLY",
        localProductId: "local-7",
        shopifyProductId: null,
        name: "Local kits",
        handle: "local-kits",
        sku: "",
        localFingerprint: "local",
        shopifyFingerprint: "missing",
        remoteMissing: false,
        matchReason: null,
        localIdentity: { name: "Local kits", handle: "local-kits", sku: "" },
        shopifyIdentity: null,
      },
      synaravaValue: "Local kits · /local-kits",
      shopifyValue: "— Collection is missing —",
      localFingerprint: "local",
      shopifyFingerprint: "missing",
    });
    mocks.loadCollectionConflictFromSyncResult.mockResolvedValue(conflict([presence], "local-7"));
    const preview = await previewCollectionConflictResolution({
      kind: "COLLECTION",
      collectionId: "local-7",
      direction: "SHOPIFY_TO_SYNARAVA",
    });
    expect(preview.entries).toHaveLength(1);
    expect(preview.entries[0]).toMatchObject({
      direction: "SHOPIFY_TO_SYNARAVA",
      willClearNonEmptyValue: true,
    });
  });
});

describe("applyCollectionConflictResolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyReconcileChoice.mockResolvedValue({ ok: true, message: "Applied" });
  });

  it("applies translation fields through reconcile choice", async () => {
    mocks.loadCollectionConflictFromSyncResult.mockResolvedValue(conflict([field()]));
    const outcome = await applyCollectionConflictResolution({
      acknowledgeClears: false,
      actorUsername: "admin",
      entries: [{
        collectionId: "collection-1",
        fieldKey: "translation:pt-PT:title",
        direction: "SHOPIFY_TO_SYNARAVA",
        expectedLocalFingerprint: "local-fp",
        expectedShopifyFingerprint: "shopify-fp",
      }],
    });
    expect(outcome.appliedCount).toBe(1);
    expect(mocks.applyReconcileChoice).toHaveBeenCalledWith({
      divergenceId: "div-1",
      choice: "SHOPIFY",
      expectedLocalFingerprint: "local-fp",
      expectedShopifyFingerprint: "shopify-fp",
      actorUsername: "admin",
    });
  });

  it("reports STALE when fingerprints no longer match", async () => {
    mocks.loadCollectionConflictFromSyncResult.mockResolvedValue(conflict([field({ localFingerprint: "changed" })]));
    const outcome = await applyCollectionConflictResolution({
      acknowledgeClears: false,
      actorUsername: "admin",
      entries: [{
        collectionId: "collection-1",
        fieldKey: "translation:pt-PT:title",
        direction: "SHOPIFY_TO_SYNARAVA",
        expectedLocalFingerprint: "local-fp",
        expectedShopifyFingerprint: "shopify-fp",
      }],
    });
    expect(outcome.appliedCount).toBe(0);
    expect(outcome.results[0]?.reason).toBe("STALE");
    expect(mocks.applyReconcileChoice).not.toHaveBeenCalled();
  });

  it("refreshes collection presence and applies a one-sided collection through the presence resolver", async () => {
    const presence = presenceField();
    mocks.scanAndSaveCollectionPresence.mockResolvedValue([]);
    mocks.loadCollectionConflictFromSyncResult.mockResolvedValue(conflict([presence], "shopify-collection:42"));
    mocks.applyCollectionPresenceDifference.mockResolvedValue({
      ok: true,
      localCollectionId: "collection-new",
      message: "Collection pulled from Shopify.",
    });

    const outcome = await applyCollectionConflictResolution({
      acknowledgeClears: false,
      actorUsername: "admin",
      entries: [{
        collectionId: "shopify-collection:42",
        fieldKey: "presence:collection",
        direction: "SHOPIFY_TO_SYNARAVA",
        expectedLocalFingerprint: "missing",
        expectedShopifyFingerprint: "remote",
      }],
    });

    expect(mocks.scanAndSaveCollectionPresence).toHaveBeenCalledWith(null);
    expect(mocks.applyCollectionPresenceDifference).toHaveBeenCalledWith({
      difference: presence.presenceDifference,
      direction: "SHOPIFY_TO_SYNARAVA",
    });
    expect(outcome).toMatchObject({
      appliedCount: 1,
      results: [{ ok: true, localCollectionId: "collection-new" }],
    });
  });

  it("previews and applies scoped commerce Name via applyCollectionCommerceField", async () => {
    const commerce = commerceField();
    mocks.loadCollectionConflictFromSyncResult.mockResolvedValue(conflict([commerce]));
    mocks.applyCollectionCommerceField.mockResolvedValue({ ok: true, message: "Name applied from Shopify." });

    const preview = await previewCollectionConflictResolution({
      kind: "COLLECTION",
      collectionId: "collection-1",
      direction: "SHOPIFY_TO_SYNARAVA",
    });
    expect(preview.entries).toHaveLength(1);
    expect(preview.entries[0].field.fieldKey).toBe("commerce:name");

    const outcome = await applyCollectionConflictResolution({
      acknowledgeClears: false,
      actorUsername: "admin",
      entries: [{
        collectionId: "collection-1",
        fieldKey: "commerce:name",
        direction: "SHOPIFY_TO_SYNARAVA",
        expectedLocalFingerprint: "commerce-local-fp",
        expectedShopifyFingerprint: "commerce-shopify-fp",
      }],
    });

    expect(mocks.applyCollectionCommerceField).toHaveBeenCalledWith({
      collectionId: "collection-1",
      label: "Name",
      fieldKey: expect.any(String),
      direction: "SHOPIFY_TO_SYNARAVA",
      expectedLocalFingerprint: "commerce-local-fp",
      expectedShopifyFingerprint: "commerce-shopify-fp",
      requestedBy: "admin",
    });
    expect(outcome.appliedCount).toBe(1);
  });

  it("applies Adopt Shopify via applyShopifyCollectionToSynarava", async () => {
    const adopt = adoptShopifyField();
    mocks.loadCollectionConflictFromSyncResult.mockResolvedValue(conflict([adopt]));
    mocks.findUniqueCollection.mockResolvedValue({ shopifyCollectionId: "gid://shopify/Collection/9" });
    mocks.applyShopifyCollectionToSynarava.mockResolvedValue({
      collectionId: "collection-1",
      shopifyCollectionId: "gid://shopify/Collection/9",
    });

    const outcome = await applyCollectionConflictResolution({
      acknowledgeClears: false,
      actorUsername: "admin",
      entries: [{
        collectionId: "collection-1",
        fieldKey: "commerce:adopt-shopify",
        direction: "SHOPIFY_TO_SYNARAVA",
        expectedLocalFingerprint: "adopt-local",
        expectedShopifyFingerprint: "adopt-shopify",
      }],
    });

    expect(mocks.applyShopifyCollectionToSynarava).toHaveBeenCalledWith(
      "gid://shopify/Collection/9",
      "collection-1",
    );
    expect(mocks.applyCollectionCommerceField).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      appliedCount: 1,
      results: [{ ok: true, localCollectionId: "collection-1" }],
    });
  });
});
