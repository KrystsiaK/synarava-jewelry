import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUniqueCollection: vi.fn(),
  updateCollection: vi.fn(),
  updateTranslations: vi.fn(),
  findFirstCollection: vi.fn(),
  shopifyAdminRequest: vi.fn(),
  findManagedCollectionSourceId: vi.fn(() => null),
  ensureTranslationBinding: vi.fn(),
  recheckEntityConflictLeaves: vi.fn(),
  gateWriteConvergence: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    collection: {
      findUnique: mocks.findUniqueCollection,
      findFirst: mocks.findFirstCollection,
      update: mocks.updateCollection,
    },
    collectionTranslation: { updateMany: mocks.updateTranslations },
  },
}));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));
vi.mock("@/lib/shopify/collection-membership", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shopify/collection-membership")>();
  return {
    ...actual,
    findManagedCollectionSourceId: mocks.findManagedCollectionSourceId,
  };
});
vi.mock("@/lib/shopify/translation-sync", () => ({
  ensureTranslationBinding: mocks.ensureTranslationBinding,
}));
vi.mock("@/lib/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sync")>();
  return {
    ...actual,
    recheckEntityConflictLeaves: mocks.recheckEntityConflictLeaves,
    gateWriteConvergence: mocks.gateWriteConvergence,
  };
});

import { createHash } from "node:crypto";
import { applyCollectionCommerceField } from "../collection-commerce-field-apply";

function fp(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function leaf(label: string, local: string, shopify: string) {
  return {
    id: "1",
    resourceType: "COLLECTION" as const,
    resourceId: "col-1",
    kind: "commerce" as const,
    locale: null,
    fieldKey: `commerce:${label.toLowerCase()}`,
    label,
    synaravaValue: local,
    shopifyValue: shopify,
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"] as const,
    blockedReason: null,
    sourceId: null,
    path: null,
    node: "base" as const,
    localFingerprint: fp(local),
    shopifyFingerprint: fp(shopify),
  };
}

function linkedCollection(overrides: Record<string, unknown> = {}) {
  return {
    id: "col-1",
    shopifyCollectionId: "gid://shopify/Collection/9",
    name: "Local name",
    slug: "local-handle",
    description: "Local desc",
    seoTitle: "Local SEO",
    seoDescription: "Local SEO desc",
    extras: null,
    shopifySnapshot: {
      id: "gid://shopify/Collection/9",
      title: "Shopify name",
      handle: "shopify-handle",
      descriptionHtml: "<p>Shopify desc</p>",
      seo: { title: "Shopify SEO", description: "Shopify SEO desc" },
    },
    ...overrides,
  };
}

describe("applyCollectionCommerceField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recheckEntityConflictLeaves.mockReset();
    mocks.gateWriteConvergence.mockReset();
    mocks.findFirstCollection.mockResolvedValue(null);
    mocks.updateTranslations.mockResolvedValue({ count: 1 });
    mocks.gateWriteConvergence.mockResolvedValue({ ok: true });
  });

  it("adopts Name from Shopify into Synarava columns (OUR window derived)", async () => {
    const before = linkedCollection();
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce({
      leaves: [leaf("Name", "Local name", "Shopify name")],
    });
    mocks.findUniqueCollection.mockResolvedValue(before);
    mocks.updateCollection.mockResolvedValue({ ...before, name: "Shopify name" });

    const result = await applyCollectionCommerceField({
      collectionId: "col-1",
      label: "Name",
      direction: "SHOPIFY_TO_SYNARAVA",
      expectedLocalFingerprint: fp("Local name"),
      expectedShopifyFingerprint: fp("Shopify name"),
      requestedBy: "admin",
    });

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(mocks.updateCollection).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "col-1" },
      data: expect.objectContaining({ name: "Shopify name" }),
    }));
    expect(mocks.gateWriteConvergence).toHaveBeenCalled();
    expect(mocks.shopifyAdminRequest).not.toHaveBeenCalled();
  });

  it("fails when convergence says the leaf remains", async () => {
    const before = linkedCollection();
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce({
      leaves: [leaf("Name", "Local name", "Shopify name")],
    });
    mocks.findUniqueCollection
      .mockResolvedValueOnce(before) // writeLocally read
      .mockResolvedValueOnce({ ...before, name: "Shopify name" }); // writeLocally verify
    mocks.updateCollection.mockResolvedValue({ ...before, name: "Shopify name" });
    mocks.gateWriteConvergence.mockResolvedValue({
      ok: false,
      message: "The write went through, but did not converge: Name. Nothing is marked resolved — try again.",
    });

    const result = await applyCollectionCommerceField({
      collectionId: "col-1",
      label: "Name",
      direction: "SHOPIFY_TO_SYNARAVA",
      expectedLocalFingerprint: fp("Local name"),
      expectedShopifyFingerprint: fp("Shopify name"),
    });

    expect(result).toMatchObject({ ok: false, reason: "WRITE_FAILED" });
    expect(result.message).toMatch(/did not converge/i);
  });

  it("pushes Handle to Shopify then refreshes shopifySnapshot only on success path", async () => {
    const before = linkedCollection();
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce({
      leaves: [leaf("Handle", "local-handle", "shopify-handle")],
    });
    mocks.findUniqueCollection
      .mockResolvedValueOnce(before) // writeToShopify
      .mockResolvedValueOnce({ // refreshShopifyCollectionState lookup
        id: "col-1",
        extras: null,
        shopifySnapshot: before.shopifySnapshot,
        name: "Local name",
        slug: "local-handle",
        description: "Local desc",
        seoTitle: "Local SEO",
        seoDescription: "Local SEO desc",
        shopifyCollectionId: before.shopifyCollectionId,
      });
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        collectionUpdate: {
          collection: { id: "gid://shopify/Collection/9", handle: "local-handle", updatedAt: "2026-10-23T12:00:00Z" },
          userErrors: [],
        },
      })
      .mockResolvedValueOnce({
        collection: {
          id: "gid://shopify/Collection/9",
          title: "Local name",
          handle: "local-handle",
          updatedAt: "2026-10-23T12:00:00Z",
          descriptionHtml: "<p>Local desc</p>",
          seo: { title: "Local SEO", description: "Local SEO desc" },
          sources: [],
        },
      });
    mocks.updateCollection.mockResolvedValue(before);

    const result = await applyCollectionCommerceField({
      collectionId: "col-1",
      label: "Handle",
      direction: "SYNARAVA_TO_SHOPIFY",
      expectedLocalFingerprint: fp("local-handle"),
      expectedShopifyFingerprint: fp("shopify-handle"),
    });

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(mocks.shopifyAdminRequest).toHaveBeenCalledWith(
      expect.stringContaining("collectionUpdate(collection: $collection)"),
      expect.objectContaining({
        collection: expect.objectContaining({
          id: "gid://shopify/Collection/9",
          handle: "local-handle",
        }),
      }),
    );
  });

  it("surfaces Shopify userErrors when pushing a commerce field", async () => {
    const before = linkedCollection();
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce({
      leaves: [leaf("Name", "Local name", "Shopify name")],
    });
    mocks.findUniqueCollection.mockResolvedValue(before);
    mocks.shopifyAdminRequest.mockResolvedValueOnce({
      collectionUpdate: {
        collection: null,
        job: null,
        userErrors: [{ message: "Title is invalid" }],
      },
    });

    const result = await applyCollectionCommerceField({
      collectionId: "col-1",
      label: "Name",
      direction: "SYNARAVA_TO_SHOPIFY",
      expectedLocalFingerprint: fp("Local name"),
      expectedShopifyFingerprint: fp("Shopify name"),
    });

    expect(result).toMatchObject({ ok: false, reason: "WRITE_FAILED" });
    expect(result.message).toMatch(/Title is invalid/);
  });

  it("rejects unsupported labels", async () => {
    const result = await applyCollectionCommerceField({
      collectionId: "col-1",
      label: "Tags",
      direction: "SHOPIFY_TO_SYNARAVA",
      expectedLocalFingerprint: fp("a"),
      expectedShopifyFingerprint: fp("b"),
    });
    expect(result).toMatchObject({ ok: false, reason: "UNSUPPORTED" });
    expect(mocks.recheckEntityConflictLeaves).not.toHaveBeenCalled();
  });
});
