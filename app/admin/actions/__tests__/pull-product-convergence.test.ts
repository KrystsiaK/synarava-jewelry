import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * STEP 7 follow-up: pull gates only fingerprint-intended leaves; revalidate
 * before gate so a failed convergence still invalidates caches.
 */

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  hasShopifyAdminConfig: vi.fn(),
  fetchShopifyShopIdentity: vi.fn(),
  assertShopifyStoreBinding: vi.fn(),
  assertWholeRecordFingerprintsFresh: vi.fn(),
  inspectProductSyncState: vi.fn(),
  applyShopifyProductToSynarava: vi.fn(),
  getSavedProductPayload: vi.fn(),
  runAfterSaveCatalogConflictCheck: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateStorefront: vi.fn(),
  gateWriteConvergence: vi.fn(),
  findUniqueProduct: vi.fn(),
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
  pushProductToShopify: vi.fn(),
  applyShopifyProductToSynarava: mocks.applyShopifyProductToSynarava,
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
  db: { product: { findUnique: mocks.findUniqueProduct } },
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

import { pullSingleProductFromShopifyAction } from "../sync";

const fingerprints = [
  {
    fieldKey: "commerce:whole-item",
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
  mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
  mocks.inspectProductSyncState.mockResolvedValue({ state: "CONFLICT" });
  mocks.applyShopifyProductToSynarava.mockResolvedValue({
    status: "SYNCED",
    productId: "product-1",
    translationStatus: "UNCHANGED",
  });
  mocks.getSavedProductPayload.mockResolvedValue({ id: "product-1", name: "Ring" });
  mocks.runAfterSaveCatalogConflictCheck.mockResolvedValue(undefined);
  mocks.gateWriteConvergence.mockResolvedValue({ ok: true });
});

describe("pullSingleProductFromShopifyAction convergence", () => {
  it("write ok + remaining sibling leaf is success (intended = fingerprints only)", async () => {
    mocks.gateWriteConvergence.mockImplementation(async (input: {
      intended: Array<{ fieldKey: string }>;
      leavesBefore: unknown[];
    }) => {
      expect(input.intended.map((item) => item.fieldKey)).toEqual(["commerce:whole-item"]);
      expect(input.leavesBefore).toEqual([]);
      return { ok: true };
    });

    const result = await pullSingleProductFromShopifyAction("product-1", true, fingerprints);

    expect(result.error).toBeUndefined();
    expect(result.success).toBeTruthy();
    expect(mocks.gateWriteConvergence).toHaveBeenCalled();
  });

  it("gate failure still invalidates caches after a successful pull", async () => {
    mocks.gateWriteConvergence.mockResolvedValue({
      ok: false,
      message: "The write went through, but did not converge: Product data (2 fields). Nothing is marked resolved — try again.",
    });

    const result = await pullSingleProductFromShopifyAction("product-1", true, fingerprints);

    expect(result.error).toMatch(/did not converge/i);
    expect(mocks.applyShopifyProductToSynarava).toHaveBeenCalled();
    expect(mocks.revalidateStorefront).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/products");
    const revalidateOrder = mocks.revalidateStorefront.mock.invocationCallOrder[0]!;
    const gateOrder = mocks.gateWriteConvergence.mock.invocationCallOrder[0]!;
    expect(revalidateOrder).toBeLessThan(gateOrder);
  });

  it("skips gate when no fingerprint intent", async () => {
    mocks.inspectProductSyncState.mockResolvedValue({ state: "SYNCED" });

    const result = await pullSingleProductFromShopifyAction("product-1", true);

    expect(result.error).toBeUndefined();
    expect(mocks.gateWriteConvergence).not.toHaveBeenCalled();
  });
});
