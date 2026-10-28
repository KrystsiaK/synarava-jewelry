import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PR-A2: commerce overwrite must not ride the old force boolean into translation writes.
 * ConflictResolver whole-record Keep ours → overwrite yes, translations no.
 * Explicit full Push → translations yes, conflict overwrite no.
 */

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  hasShopifyAdminConfig: vi.fn(),
  fetchShopifyShopIdentity: vi.fn(),
  assertShopifyStoreBinding: vi.fn(),
  assertWholeRecordFingerprintsFresh: vi.fn(),
  inspectProductSyncState: vi.fn(),
  pushProductToShopify: vi.fn(),
  getSavedProductPayload: vi.fn(),
  runAfterSaveCatalogConflictCheck: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateStorefront: vi.fn(),
  gateWriteConvergence: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/server", () => ({ after: (fn: () => void) => fn() }));
vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));
vi.mock("@/lib/shopify/admin", () => ({
  hasShopifyAdminConfig: mocks.hasShopifyAdminConfig,
  fetchShopifyShopIdentity: mocks.fetchShopifyShopIdentity,
}));
vi.mock("@/lib/shopify/store-binding", () => ({
  assertShopifyStoreBinding: mocks.assertShopifyStoreBinding,
}));
vi.mock("@/lib/shopify/catalog-conflict-apply", () => ({
  assertWholeRecordFingerprintsFresh: mocks.assertWholeRecordFingerprintsFresh,
}));
vi.mock("@/lib/shopify/product-sync", () => ({
  inspectProductSyncState: mocks.inspectProductSyncState,
  pushProductToShopify: mocks.pushProductToShopify,
  applyShopifyProductToSynarava: vi.fn(),
}));
vi.mock("@/lib/shopify/after-save-catalog-check", () => ({
  runAfterSaveCatalogConflictCheck: mocks.runAfterSaveCatalogConflictCheck,
}));
vi.mock("../shared", () => ({
  revalidateStorefront: mocks.revalidateStorefront,
}));
vi.mock("../products", () => ({
  getSavedProductPayload: mocks.getSavedProductPayload,
}));
vi.mock("@/lib/db", () => ({
  db: { product: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/shopify/product-metafields-admin", () => ({
  createProductMetafieldDefinition: vi.fn(),
  listCustomProductMetafieldDefinitions: vi.fn(),
  listProductMetafieldDefinitions: vi.fn(),
}));
vi.mock("@/lib/shopify/catalog-conflict-review", () => ({
  markIncomingProductUpdateViewed: vi.fn(),
}));
vi.mock("@/lib/sync/conflicts/service", () => ({
  applyResolution: vi.fn(),
  loadEntityConflict: vi.fn(),
  loadSignals: vi.fn(),
  previewResolution: vi.fn(),
}));
vi.mock("@/lib/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sync")>();
  return {
    ...actual,
    gateWriteConvergence: mocks.gateWriteConvergence,
  };
});

import { pushSingleProductToShopifyAction } from "../sync";

const fingerprints = [
  {
    fieldKey: "commerce:status",
    expectedLocalFingerprint: "local-fp",
    expectedShopifyFingerprint: "shop-fp",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminSession.mockResolvedValue({ username: "admin" });
  mocks.hasShopifyAdminConfig.mockReturnValue(true);
  mocks.fetchShopifyShopIdentity.mockResolvedValue({ myshopifyDomain: "test.myshopify.com" });
  mocks.assertShopifyStoreBinding.mockResolvedValue(undefined);
  mocks.assertWholeRecordFingerprintsFresh.mockResolvedValue({ ok: true });
  mocks.pushProductToShopify.mockResolvedValue({ ok: true, shopifyProductId: "gid://shopify/Product/1" });
  mocks.getSavedProductPayload.mockResolvedValue({ id: "product-1", name: "Ring" });
  mocks.runAfterSaveCatalogConflictCheck.mockResolvedValue(undefined);
  mocks.inspectProductSyncState.mockResolvedValue({ state: "CONFLICT" });
  mocks.gateWriteConvergence.mockResolvedValue({ ok: true });
});

describe("pushSingleProductToShopifyAction options", () => {
  it("commerce-only whole-record Keep ours bypasses conflict after fingerprint validation and skips translations", async () => {
    const result = await pushSingleProductToShopifyAction(
      "product-1",
      {
        authorizeCommerceConflictOverwrite: true,
        pushRegisteredTranslations: false,
      },
      fingerprints,
    );

    expect(result.error).toBeUndefined();
    expect(mocks.assertWholeRecordFingerprintsFresh).toHaveBeenCalledWith({
      productId: "product-1",
      expected: fingerprints,
      actorUsername: "admin",
    });
    expect(mocks.pushProductToShopify).toHaveBeenCalledWith("product-1", {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: false,
    });
    expect(result.success).toMatch(/Commerce/i);
    expect(result.success).not.toMatch(/registered translations/i);
  });

  it("write ok + remaining translation leaf is success (intended = fingerprint fields only)", async () => {
    // Gate sees only commerce:status as intended — a leftover translation leaf
    // must not fail Keep ours (Push does not clear translations when off).
    mocks.gateWriteConvergence.mockImplementation(async (input: {
      intended: Array<{ fieldKey: string }>;
      leavesBefore: unknown[];
    }) => {
      expect(input.intended.map((item) => item.fieldKey)).toEqual(["commerce:status"]);
      expect(input.leavesBefore).toEqual([]);
      return { ok: true };
    });

    const result = await pushSingleProductToShopifyAction(
      "product-1",
      {
        authorizeCommerceConflictOverwrite: true,
        pushRegisteredTranslations: false,
      },
      fingerprints,
    );

    expect(result.error).toBeUndefined();
    expect(result.success).toBeTruthy();
    expect(mocks.gateWriteConvergence).toHaveBeenCalled();
  });

  it("gate failure still invalidates caches after a successful write", async () => {
    mocks.gateWriteConvergence.mockResolvedValue({
      ok: false,
      message: "The write went through, but did not converge: Status. Nothing is marked resolved — try again.",
    });

    const result = await pushSingleProductToShopifyAction(
      "product-1",
      {
        authorizeCommerceConflictOverwrite: true,
        pushRegisteredTranslations: false,
      },
      fingerprints,
    );

    expect(result.error).toMatch(/did not converge/i);
    expect(mocks.pushProductToShopify).toHaveBeenCalled();
    expect(mocks.revalidateStorefront).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/products");
    // Gate ran after revalidate — order matters when the request is cut mid-gate.
    const revalidateOrder = mocks.revalidateStorefront.mock.invocationCallOrder[0]!;
    const gateOrder = mocks.gateWriteConvergence.mock.invocationCallOrder[0]!;
    expect(revalidateOrder).toBeLessThan(gateOrder);
  });

  it("skips convergence gate when no fingerprint intent (explicit Push)", async () => {
    mocks.inspectProductSyncState.mockResolvedValue({ state: "SYNCED" });

    const result = await pushSingleProductToShopifyAction("product-1");

    expect(result.error).toBeUndefined();
    expect(mocks.gateWriteConvergence).not.toHaveBeenCalled();
    expect(mocks.pushProductToShopify).toHaveBeenCalledWith("product-1", {
      authorizeCommerceConflictOverwrite: false,
      pushRegisteredTranslations: true,
    });
    expect(result.success).toMatch(/registered translations/i);
  });

  it("blocks push when conflict overwrite is not authorized", async () => {
    const result = await pushSingleProductToShopifyAction("product-1", {
      authorizeCommerceConflictOverwrite: false,
      pushRegisteredTranslations: true,
    });

    expect(result).toMatchObject({
      error: "Shopify has newer changes. Review the conflict before pushing.",
    });
    expect(mocks.pushProductToShopify).not.toHaveBeenCalled();
  });
});
