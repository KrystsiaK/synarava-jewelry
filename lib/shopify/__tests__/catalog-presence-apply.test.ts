import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pullShopifyProduct: vi.fn(),
  pushProductToShopify: vi.fn(),
  ensureTranslationBinding: vi.fn(),
  findSnapshot: vi.fn(),
  updateSnapshot: vi.fn(),
  deleteBindings: vi.fn(),
  clearVariants: vi.fn(),
  updateProduct: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    shopifyCatalogPresenceSnapshot: { findUnique: mocks.findSnapshot, update: mocks.updateSnapshot },
    shopifyTranslationBinding: { deleteMany: mocks.deleteBindings },
    productVariant: { updateMany: mocks.clearVariants },
    product: { update: mocks.updateProduct },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/shopify/admin", () => ({ shopifyAdminRequest: vi.fn() }));
vi.mock("@/lib/shopify/product-sync", () => ({
  pullShopifyProduct: mocks.pullShopifyProduct,
  pushProductToShopify: mocks.pushProductToShopify,
}));
vi.mock("@/lib/shopify/translation-sync", () => ({ ensureTranslationBinding: mocks.ensureTranslationBinding }));

import { applyCatalogPresenceDifference } from "@/lib/shopify/catalog-presence-server";

const shopifyOnly = {
  id: "shopify:42", kind: "SHOPIFY_ONLY" as const, localProductId: null,
  shopifyProductId: "gid://shopify/Product/42", name: "Remote ring", handle: "remote-ring", sku: "R-42",
  localFingerprint: "missing", shopifyFingerprint: "remote", remoteMissing: false, matchReason: null,
  localIdentity: null, shopifyIdentity: { name: "Remote ring", handle: "remote-ring", sku: "R-42" },
};

const remoteMissing = {
  id: "local-7", kind: "SYNARAVA_ONLY" as const, localProductId: "local-7",
  shopifyProductId: "gid://shopify/Product/7", name: "Local ring", handle: "local-ring", sku: "L-7",
  localFingerprint: "local", shopifyFingerprint: "missing", remoteMissing: true, matchReason: null,
  localIdentity: { name: "Local ring", handle: "local-ring", sku: "L-7" }, shopifyIdentity: null,
};

describe("applyCatalogPresenceDifference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSnapshot.mockResolvedValue({ differences: [shopifyOnly, remoteMissing] });
    mocks.updateSnapshot.mockResolvedValue({});
    mocks.ensureTranslationBinding.mockResolvedValue({});
    mocks.deleteBindings.mockReturnValue(Promise.resolve({ count: 1 }));
    mocks.clearVariants.mockReturnValue(Promise.resolve({ count: 1 }));
    mocks.updateProduct.mockReturnValue(Promise.resolve({ id: "local-7" }));
    mocks.transaction.mockResolvedValue([]);
  });

  it("pulls a Shopify-only product, creates its binding, and removes the saved difference", async () => {
    mocks.pullShopifyProduct.mockResolvedValue({ productId: "local-new", status: "SYNCED" });

    const result = await applyCatalogPresenceDifference({ difference: shopifyOnly, direction: "SHOPIFY_TO_SYNARAVA" });

    expect(result).toMatchObject({ ok: true, localProductId: "local-new" });
    expect(mocks.ensureTranslationBinding).toHaveBeenCalledWith({
      resourceType: "PRODUCT", entityId: "local-new", shopifyResourceId: "gid://shopify/Product/42",
    });
    expect(mocks.updateSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      data: { differences: [remoteMissing] },
    }));
  });

  it("clears dead Shopify identities before recreating a remote-missing product", async () => {
    mocks.pushProductToShopify.mockResolvedValue({ ok: true, shopifyProductId: "gid://shopify/Product/70" });

    const result = await applyCatalogPresenceDifference({ difference: remoteMissing, direction: "SYNARAVA_TO_SHOPIFY" });

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.updateProduct).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "local-7" }, data: expect.objectContaining({ shopifyProductId: null, syncStatus: "UNLINKED" }),
    }));
    expect(mocks.pushProductToShopify).toHaveBeenCalledWith("local-7", true);
    expect(mocks.ensureTranslationBinding).toHaveBeenCalledWith({
      resourceType: "PRODUCT", entityId: "local-7", shopifyResourceId: "gid://shopify/Product/70",
    });
    expect(result).toMatchObject({ ok: true, localProductId: "local-7" });
  });

  it("refuses the impossible direction without writing", async () => {
    const result = await applyCatalogPresenceDifference({ difference: shopifyOnly, direction: "SYNARAVA_TO_SHOPIFY" });

    expect(result).toMatchObject({ ok: false, reason: "UNSUPPORTED" });
    expect(mocks.pullShopifyProduct).not.toHaveBeenCalled();
    expect(mocks.pushProductToShopify).not.toHaveBeenCalled();
  });
});
