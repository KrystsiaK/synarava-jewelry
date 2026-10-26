import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  recheckEntityConflictLeaves: vi.fn(),
  fetchShopifyProduct: vi.fn(),
  adoptShopifyProjectionField: vi.fn(),
  pushProductToShopify: vi.fn(),
  findUniqueProduct: vi.fn(),
  findFirstProduct: vi.fn(),
  updateProduct: vi.fn(),
  findManyVariant: vi.fn(),
  updateVariant: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyAdminRequest: mocks.request,
}));
vi.mock("@/lib/sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sync")>("@/lib/sync");
  return {
    ...actual,
    recheckEntityConflictLeaves: mocks.recheckEntityConflictLeaves,
  };
});
vi.mock("@/lib/shopify/product-sync", () => ({
  fetchShopifyProduct: mocks.fetchShopifyProduct,
  adoptShopifyProjectionField: mocks.adoptShopifyProjectionField,
  pushProductToShopify: mocks.pushProductToShopify,
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findUnique: mocks.findUniqueProduct,
      findFirst: mocks.findFirstProduct,
      update: mocks.updateProduct,
    },
    productVariant: { findMany: mocks.findManyVariant, update: mocks.updateVariant },
  },
}));

import { applyCommerceField, SCOPED_COMMERCE_FIELD_LABELS } from "@/lib/shopify/commerce-field-apply";
import { commerceFingerprint } from "@/lib/shopify/catalog-conflict";
import type { SyncLeaf } from "@/lib/sync";

function leaf(label: string, local: string, shopify: string, overrides: Partial<SyncLeaf> = {}): SyncLeaf {
  return {
    id: `PRODUCT:product-1:commerce:${label}`,
    resourceType: "PRODUCT",
    resourceId: "product-1",
    kind: "commerce",
    locale: null,
    fieldKey: `commerce:${label.toLowerCase().replace(/\s+/g, "-")}`,
    label,
    synaravaValue: local,
    shopifyValue: shopify,
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    path: label === "Vendor" ? "vendor" : label.toLowerCase(),
    localFingerprint: commerceFingerprint(local),
    shopifyFingerprint: commerceFingerprint(shopify),
    ...overrides,
  };
}

function leaves(...items: SyncLeaf[]) {
  return { leaves: items };
}

function fingerprintsFor(local: string, shopify: string) {
  return { expectedLocalFingerprint: commerceFingerprint(local), expectedShopifyFingerprint: commerceFingerprint(shopify) };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.recheckEntityConflictLeaves.mockResolvedValue(leaves());
  mocks.adoptShopifyProjectionField.mockResolvedValue(undefined);
});

describe("SCOPED_COMMERCE_FIELD_LABELS", () => {
  it("is exactly the plain-scalar fields with a single-field mutation, and nothing structural", () => {
    expect([...SCOPED_COMMERCE_FIELD_LABELS].sort()).toEqual(
      ["Charge tax", "Compare-at price", "Handle", "Media gallery", "Name", "Price", "Product type", "Variant SKU", "Vendor"].sort(),
    );
  });
});

describe("applyCommerceField — Name and Handle", () => {
  it("writes Name locally from Shopify", async () => {
    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Name", "Old Name", "New Name")))
      .mockResolvedValueOnce(leaves());
    mocks.updateProduct.mockResolvedValue({ name: "New Name" });

    const result = await applyCommerceField({
      productId: "product-1",
      label: "Name",
      direction: "SHOPIFY_TO_SYNARAVA",
      ...fingerprintsFor("Old Name", "New Name"),
    });

    expect(mocks.updateProduct).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { name: "New Name" },
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("pushes Handle to Shopify and rejects empty handles", async () => {
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(leaves(leaf("Handle", "—", "shop-handle")));
    const empty = await applyCommerceField({
      productId: "product-1",
      label: "Handle",
      direction: "SYNARAVA_TO_SHOPIFY",
      ...fingerprintsFor("—", "shop-handle"),
    });
    expect(empty).toMatchObject({ ok: false, reason: "WRITE_FAILED" });
    expect(mocks.request).not.toHaveBeenCalled();

    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Handle", "our-handle", "shop-handle")))
      .mockResolvedValueOnce(leaves());
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({
      productUpdate: {
        product: { id: "gid://shopify/Product/1", title: "x", handle: "our-handle", vendor: null, productType: null },
        userErrors: [],
      },
    });

    const result = await applyCommerceField({
      productId: "product-1",
      label: "Handle",
      direction: "SYNARAVA_TO_SHOPIFY",
      ...fingerprintsFor("our-handle", "shop-handle"),
    });

    expect(mocks.request).toHaveBeenCalledWith(
      expect.stringContaining("productUpdate"),
      expect.objectContaining({
        product: { id: "gid://shopify/Product/1", handle: "our-handle" },
      }),
    );
    expect(result).toMatchObject({ ok: true });
  });
});

describe("applyCommerceField — re-validates immediately before writing (TOCTOU)", () => {
  it("returns STALE and writes nothing when the field is no longer in the fresh leaves list", async () => {
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(leaves());

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
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(
      leaves(leaf("Vendor", "Old Vendor", "Changed-again Vendor")),
    );

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SHOPIFY_TO_SYNARAVA", ...previewedFingerprints,
    });

    expect(result).toMatchObject({ ok: false, reason: "STALE" });
    expect(mocks.updateProduct).not.toHaveBeenCalled();
  });

  it("returns STALE and writes nothing when Synarava's value changed between preview and this call", async () => {
    const previewedFingerprints = fingerprintsFor("Preview-time Vendor", "Shopify Vendor");
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(
      leaves(leaf("Vendor", "Someone-else-edited Vendor", "Shopify Vendor")),
    );

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...previewedFingerprints,
    });

    expect(result).toMatchObject({ ok: false, reason: "STALE" });
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("proceeds to write when the fresh values still match what preview showed", async () => {
    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Vendor", "Old Vendor", "—")))
      .mockResolvedValueOnce(leaves());
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
    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Price", "9900", "12000")))
      .mockResolvedValueOnce(leaves());
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
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(leaves(leaf("Variant SKU", "SKU-1", "SKU-9")));
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
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(leaves(leaf("Price", "9900", "12000")));
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
    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Variant SKU", "SKU-OLD", "SKU-NEW")))
      .mockResolvedValueOnce(leaves());
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
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(leaves(leaf("Vendor", "Old Vendor", "New Vendor")));
    mocks.updateProduct.mockResolvedValue({ vendor: "Something else entirely" });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("Old Vendor", "New Vendor"),
    });

    expect(result).toMatchObject({ ok: false, reason: "WRITE_FAILED" });
  });

  it("fails when Shopify's mutation response doesn't echo back the value that was sent", async () => {
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(leaves(leaf("Vendor", "New Vendor", "Old Vendor")));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({ productUpdate: { product: { id: "gid://shopify/Product/1", vendor: "Not what we sent", productType: null }, userErrors: [] } });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("New Vendor", "Old Vendor"),
    });

    expect(result).toMatchObject({ ok: false, reason: "WRITE_FAILED", message: expect.stringContaining("read-back value did not match") });
  });

  it("surfaces Shopify userErrors as a failed result instead of throwing", async () => {
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(leaves(leaf("Vendor", "", "Old Vendor")));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({ productUpdate: { product: null, userErrors: [{ field: ["vendor"], message: "Vendor can't be blank" }] } });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("", "Old Vendor"),
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("Vendor can't be blank") });
  });

  it("fails cleanly when the product isn't linked to Shopify, without touching the network", async () => {
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(leaves(leaf("Vendor", "New Vendor", "Old Vendor")));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: null });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("New Vendor", "Old Vendor"),
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("not linked") });
    expect(mocks.request).not.toHaveBeenCalled();
  });
});

describe("applyCommerceField — post-write leaf verify (no syncStatus inventory write)", () => {
  it("reports ok when the field leaf is gone after write — does not write syncStatus SYNCED", async () => {
    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Vendor", "Old Vendor", "—")))
      .mockResolvedValueOnce(leaves());
    mocks.updateProduct.mockResolvedValueOnce({ vendor: null });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("Old Vendor", "—"),
    });

    expect(result).toMatchObject({ ok: true });
    // Only the field write itself — no second syncStatus SYNCED update.
    expect(mocks.updateProduct).toHaveBeenCalledTimes(1);
    expect(mocks.updateProduct).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { vendor: null },
    });
  });

  it("REGRESSION: reports failure when post-write recheck cannot run (remote missing)", async () => {
    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Vendor", "Old Vendor", "—")))
      .mockRejectedValueOnce(new Error("Shopify product gid://shopify/Product/1 was not found."));
    mocks.updateProduct.mockResolvedValueOnce({ vendor: null });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("Old Vendor", "—"),
    });

    expect(result).toMatchObject({ ok: false, reason: "WRITE_FAILED", message: expect.stringContaining("no longer exists") });
    expect(mocks.updateProduct).toHaveBeenCalledTimes(1);
  });

  it("succeeds when another field still conflicts — applied leaf gone, no SYNCED write", async () => {
    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Price", "9900", "12000")))
      .mockResolvedValueOnce(leaves(leaf("Status", "ACTIVE", "DRAFT")));
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
    expect(mocks.updateProduct).not.toHaveBeenCalled();
  });

  it("REGRESSION: reports failure when the just-applied field is still conflicting after re-checking", async () => {
    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Vendor", "Old Vendor", "New Vendor")))
      .mockResolvedValueOnce(leaves(leaf("Vendor", "Old Vendor", "New Vendor")));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({ productUpdate: { product: { id: "gid://shopify/Product/1", vendor: "Old Vendor", productType: null }, userErrors: [] } });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("Old Vendor", "New Vendor"),
    });

    expect(result).toMatchObject({ ok: false, reason: "WRITE_FAILED" });
    expect(mocks.updateProduct).not.toHaveBeenCalled();
  });

  it("does not recheck leaves when the write itself failed", async () => {
    mocks.recheckEntityConflictLeaves.mockResolvedValueOnce(leaves(leaf("Vendor", "Old Vendor", "New Vendor")));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: null });

    await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", ...fingerprintsFor("Old Vendor", "New Vendor"),
    });

    expect(mocks.recheckEntityConflictLeaves).toHaveBeenCalledTimes(1);
  });
});

describe("applyCommerceField — unsupported field", () => {
  it("refuses a field outside SCOPED_COMMERCE_FIELD_LABELS without touching the network or DB", async () => {
    const result = await applyCommerceField({
      productId: "product-1", label: "Status", direction: "SHOPIFY_TO_SYNARAVA", ...fingerprintsFor("ACTIVE", "DRAFT"),
    });

    expect(result).toMatchObject({ ok: false, reason: "UNSUPPORTED" });
    expect(mocks.recheckEntityConflictLeaves).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.updateVariant).not.toHaveBeenCalled();
  });
});

describe("applyCommerceField — Media gallery", () => {
  it("Pull adopts the whole media path from Shopify into OUR", async () => {
    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Media gallery (image 1)", "—", "ring.jpg", { path: "media" })))
      .mockResolvedValueOnce(leaves());

    const result = await applyCommerceField({
      productId: "product-1",
      label: "Media gallery (image 1)",
      direction: "SHOPIFY_TO_SYNARAVA",
      ...fingerprintsFor("—", "ring.jpg"),
    });

    expect(result).toMatchObject({ ok: true });
    expect(mocks.adoptShopifyProjectionField).toHaveBeenCalledWith("product-1", "media");
    expect(mocks.pushProductToShopify).not.toHaveBeenCalled();
  });

  it("Push runs the product push pipeline then adopts media echo", async () => {
    mocks.recheckEntityConflictLeaves
      .mockResolvedValueOnce(leaves(leaf("Media gallery (image 1)", "local.jpg", "—", { path: "media" })))
      .mockResolvedValueOnce(leaves());
    mocks.pushProductToShopify.mockResolvedValue({ ok: true, shopifyProductId: "gid://shopify/Product/1" });

    const result = await applyCommerceField({
      productId: "product-1",
      label: "Media gallery (image 1)",
      direction: "SYNARAVA_TO_SHOPIFY",
      ...fingerprintsFor("local.jpg", "—"),
    });

    expect(result).toMatchObject({ ok: true });
    expect(mocks.pushProductToShopify).toHaveBeenCalledWith("product-1", true);
    expect(mocks.adoptShopifyProjectionField).toHaveBeenCalledWith("product-1", "media");
  });
});
