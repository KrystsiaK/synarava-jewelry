import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  inspectProductSyncState: vi.fn(),
  fetchShopifyProduct: vi.fn(),
  findUniqueProduct: vi.fn(),
  updateProduct: vi.fn(),
  findManyVariant: vi.fn(),
  updateVariant: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyAdminRequest: mocks.request,
}));
vi.mock("@/lib/shopify/product-sync", () => ({
  inspectProductSyncState: mocks.inspectProductSyncState,
  fetchShopifyProduct: mocks.fetchShopifyProduct,
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: mocks.findUniqueProduct, update: mocks.updateProduct },
    productVariant: { findMany: mocks.findManyVariant, update: mocks.updateVariant },
  },
}));

import { applyCommerceField, SCOPED_COMMERCE_FIELD_LABELS } from "@/lib/shopify/commerce-field-apply";
import { commerceFingerprint } from "@/lib/shopify/catalog-conflict";

function inspection(overrides: Partial<Record<string, unknown>> = {}) {
  return { state: "CONFLICT", remoteUpdatedAt: null, publications: [], differences: [], ...overrides };
}

function diff(field: string, local: string, shopify: string) {
  return { field, local, shopify };
}

function fingerprintsFor(local: string, shopify: string) {
  return { expectedLocalFingerprint: commerceFingerprint(local), expectedShopifyFingerprint: commerceFingerprint(shopify) };
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) so a test that throws before consuming
  // every queued mockResolvedValueOnce() never leaks a stale value into the
  // next test's first call.
  vi.resetAllMocks();
  // Post-write refresh: default to "still conflicted" (no extra DB write) unless a test overrides it.
  mocks.inspectProductSyncState.mockResolvedValue(inspection());
});

describe("SCOPED_COMMERCE_FIELD_LABELS", () => {
  it("is exactly the plain-scalar fields with a single-field mutation, and nothing structural", () => {
    expect([...SCOPED_COMMERCE_FIELD_LABELS].sort()).toEqual(
      ["Compare-at price", "Price", "Product type", "Variant SKU", "Vendor"].sort(),
    );
  });
});

describe("applyCommerceField — re-validates immediately before writing (TOCTOU)", () => {
  it("returns STALE and writes nothing when the field is no longer in the fresh differences list", async () => {
    mocks.inspectProductSyncState.mockResolvedValueOnce(inspection({ differences: [] }));

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SHOPIFY_TO_SYNARAVA",
      ...fingerprintsFor("Old Vendor", "New Vendor"),
    });

    expect(result).toMatchObject({ ok: false, reason: "STALE" });
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("returns STALE and writes nothing when Shopify's value changed between preview and this call", async () => {
    const previewedFingerprints = fingerprintsFor("Old Vendor", "Preview-time Vendor");
    // By the time apply runs, Shopify's vendor has moved on again.
    mocks.inspectProductSyncState.mockResolvedValueOnce(inspection({ differences: [diff("Vendor", "Old Vendor", "Changed-again Vendor")] }));

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SHOPIFY_TO_SYNARAVA", ...previewedFingerprints,
    });

    expect(result).toMatchObject({ ok: false, reason: "STALE" });
    expect(mocks.updateProduct).not.toHaveBeenCalled();
  });

  it("returns STALE and writes nothing when Synarava's value changed between preview and this call", async () => {
    const previewedFingerprints = fingerprintsFor("Preview-time Vendor", "Shopify Vendor");
    mocks.inspectProductSyncState.mockResolvedValueOnce(inspection({ differences: [diff("Vendor", "Someone-else-edited Vendor", "Shopify Vendor")] }));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...previewedFingerprints,
    });

    expect(result).toMatchObject({ ok: false, reason: "STALE" });
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("proceeds to write when the fresh values still match what preview showed", async () => {
    mocks.inspectProductSyncState
      .mockResolvedValueOnce(inspection({ differences: [diff("Vendor", "Old Vendor", "—")] }))
      .mockResolvedValueOnce(inspection()); // post-write refresh
    mocks.updateProduct.mockResolvedValue({ vendor: null });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("Old Vendor", "—"),
    });

    expect(mocks.updateProduct).toHaveBeenCalledWith({ where: { id: "product-1" }, data: { vendor: null } });
    expect(result).toMatchObject({ ok: true });
  });
});

describe("applyCommerceField — variant matching for SKU/Price/Compare-at price", () => {
  it("writes to the single local variant matched with the single Shopify variant — not just findFirst", async () => {
    mocks.inspectProductSyncState
      .mockResolvedValueOnce(inspection({ differences: [diff("Price", "9900", "12000")] }))
      .mockResolvedValueOnce(inspection());
    mocks.findManyVariant.mockResolvedValue([{ id: "variant-local-1" }]);
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.fetchShopifyProduct.mockResolvedValue({ variants: { nodes: [{ id: "gid://shopify/ProductVariant/9" }] } });
    mocks.updateVariant.mockResolvedValue({ priceCents: 12000 });

    const result = await applyCommerceField({
      productId: "product-1", label: "Price", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("9900", "12000"),
    });

    expect(mocks.findManyVariant).toHaveBeenCalledWith({ where: { productId: "product-1" }, select: { id: true } });
    expect(mocks.updateVariant).toHaveBeenCalledWith({ where: { id: "variant-local-1" }, data: { priceCents: 12000 } });
    expect(result).toMatchObject({ ok: true });
  });

  it("returns UNSUPPORTED without writing when there are several local variants but only one Shopify variant", async () => {
    mocks.inspectProductSyncState.mockResolvedValueOnce(inspection({ differences: [diff("Variant SKU", "SKU-1", "SKU-9")] }));
    mocks.findManyVariant.mockResolvedValue([{ id: "variant-local-1" }, { id: "variant-local-2" }]);
    mocks.fetchShopifyProduct.mockResolvedValue({ variants: { nodes: [{ id: "gid://shopify/ProductVariant/9" }] } });

    const result = await applyCommerceField({
      productId: "product-1", label: "Variant SKU", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("SKU-1", "SKU-9"),
    });

    expect(result).toMatchObject({ ok: false, reason: "UNSUPPORTED" });
    expect(mocks.updateVariant).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("returns UNSUPPORTED without writing when Shopify itself reports more than one variant", async () => {
    mocks.inspectProductSyncState.mockResolvedValueOnce(inspection({ differences: [diff("Price", "9900", "12000")] }));
    mocks.findManyVariant.mockResolvedValue([{ id: "variant-local-1" }]);
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.fetchShopifyProduct.mockResolvedValue({ variants: { nodes: [{ id: "v1" }, { id: "v2" }] } });

    const result = await applyCommerceField({
      productId: "product-1", label: "Price", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("9900", "12000"),
    });

    expect(mocks.fetchShopifyProduct).toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: "UNSUPPORTED" });
    expect(mocks.updateVariant).not.toHaveBeenCalled();
  });

  it("uses the freshly-fetched Shopify variant id for the write, not a possibly-stale local shopifyVariantId column", async () => {
    mocks.inspectProductSyncState
      .mockResolvedValueOnce(inspection({ differences: [diff("Variant SKU", "SKU-OLD", "SKU-NEW")] }))
      .mockResolvedValueOnce(inspection());
    mocks.findManyVariant.mockResolvedValue([{ id: "variant-local-1" }]);
    mocks.fetchShopifyProduct.mockResolvedValue({ variants: { nodes: [{ id: "gid://shopify/ProductVariant/live-9" }] } });
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({
      productVariantsBulkUpdate: { productVariants: [{ id: "gid://shopify/ProductVariant/live-9", price: "0.00", compareAtPrice: null, inventoryItem: { sku: "SKU-OLD" } }], userErrors: [] },
    });

    const result = await applyCommerceField({
      productId: "product-1", label: "Variant SKU", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("SKU-OLD", "SKU-NEW"),
    });
    expect(result).toMatchObject({ ok: true });

    const [, variables] = mocks.request.mock.calls[0];
    expect(variables).toMatchObject({ variants: [{ id: "gid://shopify/ProductVariant/live-9", inventoryItem: { sku: "SKU-OLD" } }] });
  });
});

describe("applyCommerceField — read-after-write verification", () => {
  it("fails when the local write's returned row doesn't reflect the intended value", async () => {
    mocks.inspectProductSyncState.mockResolvedValueOnce(inspection({ differences: [diff("Vendor", "Old Vendor", "New Vendor")] }));
    mocks.updateProduct.mockResolvedValue({ vendor: "Something else entirely" });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("Old Vendor", "New Vendor"),
    });

    expect(result).toMatchObject({ ok: false, reason: "WRITE_FAILED" });
  });

  it("fails when Shopify's mutation response doesn't echo back the value that was sent", async () => {
    mocks.inspectProductSyncState.mockResolvedValueOnce(inspection({ differences: [diff("Vendor", "New Vendor", "Old Vendor")] }));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({ productUpdate: { product: { id: "gid://shopify/Product/1", vendor: "Not what we sent", productType: null }, userErrors: [] } });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("New Vendor", "Old Vendor"),
    });

    expect(result).toMatchObject({ ok: false, reason: "WRITE_FAILED", message: expect.stringContaining("read-back value did not match") });
  });

  it("surfaces Shopify userErrors as a failed result instead of throwing", async () => {
    mocks.inspectProductSyncState.mockResolvedValueOnce(inspection({ differences: [diff("Vendor", "", "Old Vendor")] }));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({ productUpdate: { product: null, userErrors: [{ field: ["vendor"], message: "Vendor can't be blank" }] } });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("", "Old Vendor"),
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("Vendor can't be blank") });
  });

  it("fails cleanly when the product isn't linked to Shopify, without touching the network", async () => {
    mocks.inspectProductSyncState.mockResolvedValueOnce(inspection({ differences: [diff("Vendor", "New Vendor", "Old Vendor")] }));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: null });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("New Vendor", "Old Vendor"),
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("not linked") });
    expect(mocks.request).not.toHaveBeenCalled();
  });
});

describe("applyCommerceField — refreshes persisted sync state after a successful write", () => {
  it("clears the product off CONFLICT once nothing else differs, so it can drop out of the catalog-wide list", async () => {
    mocks.inspectProductSyncState
      .mockResolvedValueOnce(inspection({ differences: [diff("Vendor", "Old Vendor", "—")] })) // pre-write check
      .mockResolvedValueOnce(inspection({ state: "LOCAL_CHANGES", remoteUpdatedAt: "2026-09-23T00:00:00.000Z", differences: [] })); // post-write refresh
    mocks.updateProduct.mockResolvedValueOnce({ vendor: null }); // the field write itself

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("Old Vendor", "—"),
    });

    expect(result).toMatchObject({ ok: true });
    // Second updateProduct call is the sync-state refresh, distinct from the field write itself.
    expect(mocks.updateProduct).toHaveBeenCalledTimes(2);
    expect(mocks.updateProduct).toHaveBeenLastCalledWith({
      where: { id: "product-1" },
      data: { syncStatus: "PENDING", syncError: null, shopifyUpdatedAt: new Date("2026-09-23T00:00:00.000Z") },
    });
  });

  it("leaves the persisted sync state alone when another (unsupported) field is still genuinely conflicting — that conflict stays visible", async () => {
    mocks.inspectProductSyncState
      .mockResolvedValueOnce(inspection({ differences: [diff("Price", "9900", "12000")] })) // pre-write check
      .mockResolvedValueOnce(inspection({ state: "CONFLICT", differences: [diff("Status", "ACTIVE", "DRAFT")] })); // post-write: Status still conflicts
    mocks.findManyVariant.mockResolvedValue([{ id: "variant-local-1" }]);
    mocks.fetchShopifyProduct.mockResolvedValue({ variants: { nodes: [{ id: "gid://shopify/ProductVariant/9" }] } });
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({
      productVariantsBulkUpdate: { productVariants: [{ id: "gid://shopify/ProductVariant/9", price: "99.00", compareAtPrice: null, inventoryItem: { sku: null } }], userErrors: [] },
    });

    const result = await applyCommerceField({
      productId: "product-1", label: "Price", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("9900", "12000"),
    });

    expect(result).toMatchObject({ ok: true });
    // No local Product write at all here — the field itself was written to
    // Shopify (variant mutation), and the still-CONFLICT refresh must not
    // touch syncStatus either.
    expect(mocks.updateProduct).not.toHaveBeenCalled();
  });

  it("marks the product fully SYNCED when the write resolves the last difference and nothing else differs", async () => {
    mocks.inspectProductSyncState
      .mockResolvedValueOnce(inspection({ differences: [diff("Vendor", "Old Vendor", "New Vendor")] }))
      .mockResolvedValueOnce(inspection({ state: "SYNCED", remoteUpdatedAt: "2026-09-23T01:00:00.000Z", differences: [] }));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({ productUpdate: { product: { id: "gid://shopify/Product/1", vendor: "Old Vendor", productType: null }, userErrors: [] } });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("Old Vendor", "New Vendor"),
    });
    expect(result).toMatchObject({ ok: true });

    expect(mocks.updateProduct).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: expect.objectContaining({ syncStatus: "SYNCED", syncError: null, lastSyncedAt: expect.any(Date) }),
    });
  });

  it("does not refresh sync state at all when the write itself failed", async () => {
    mocks.inspectProductSyncState.mockResolvedValueOnce(inspection({ differences: [diff("Vendor", "Old Vendor", "New Vendor")] }));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: null }); // write fails: not linked to Shopify

    await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("Old Vendor", "New Vendor"),
    });

    // Only the one pre-write inspection call — no second (post-write refresh) call.
    expect(mocks.inspectProductSyncState).toHaveBeenCalledTimes(1);
  });
});

describe("applyCommerceField — unsupported field", () => {
  it("refuses a field outside SCOPED_COMMERCE_FIELD_LABELS without touching the network, DB, or even inspecting", async () => {
    const result = await applyCommerceField({
      productId: "product-1", label: "Status", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("ACTIVE", "DRAFT"),
    });

    expect(result).toMatchObject({ ok: false, reason: "UNSUPPORTED" });
    expect(mocks.inspectProductSyncState).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.updateVariant).not.toHaveBeenCalled();
  });
});
