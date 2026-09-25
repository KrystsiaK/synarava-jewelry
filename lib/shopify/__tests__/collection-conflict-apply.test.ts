import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCollectionCatalogConflict: vi.fn(),
  listConflictedCollectionIds: vi.fn(),
  applyReconcileChoice: vi.fn(),
}));

vi.mock("@/lib/shopify/collection-conflict", () => ({
  getCollectionCatalogConflict: mocks.getCollectionCatalogConflict,
  listConflictedCollectionIds: mocks.listConflictedCollectionIds,
}));

vi.mock("@/lib/shopify/reconciliation-apply", () => ({
  applyReconcileChoice: mocks.applyReconcileChoice,
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
    baseValue: null,
    localFingerprint: "local-fp",
    shopifyFingerprint: "shopify-fp",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: "div-1",
    ...overrides,
  };
}

function conflict(fields: CatalogConflictField[], collectionId = "collection-1") {
  return { collectionId, fields };
}

describe("previewCollectionConflictResolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes supported translation fields for a collection direction", async () => {
    mocks.getCollectionCatalogConflict.mockResolvedValue(conflict([field()]));
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
    mocks.getCollectionCatalogConflict.mockImplementation(async (collectionId: string) =>
      conflict([field({ fieldKey: `translation:pt-PT:title:${collectionId}` })], collectionId),
    );
    const preview = await previewCollectionConflictResolution({
      kind: "BULK",
      direction: "SYNARAVA_TO_SHOPIFY",
    });
    expect(preview.entries).toHaveLength(2);
    expect(mocks.getCollectionCatalogConflict).toHaveBeenCalledTimes(2);
  });
});

describe("applyCollectionConflictResolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyReconcileChoice.mockResolvedValue({ ok: true, message: "Applied" });
  });

  it("applies translation fields through reconcile choice", async () => {
    mocks.getCollectionCatalogConflict.mockResolvedValue(conflict([field()]));
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
    mocks.getCollectionCatalogConflict.mockResolvedValue(conflict([field({ localFingerprint: "changed" })]));
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
});
