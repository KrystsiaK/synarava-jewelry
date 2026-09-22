import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  findUniqueProduct: vi.fn(),
  updateProduct: vi.fn(),
  findFirstVariant: vi.fn(),
  updateVariant: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyAdminRequest: mocks.request,
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: mocks.findUniqueProduct, update: mocks.updateProduct },
    productVariant: { findFirst: mocks.findFirstVariant, update: mocks.updateVariant },
  },
}));

import { applyCommerceField, SCOPED_COMMERCE_FIELD_LABELS } from "@/lib/shopify/commerce-field-apply";

beforeEach(() => vi.clearAllMocks());

describe("SCOPED_COMMERCE_FIELD_LABELS", () => {
  it("is exactly the plain-scalar fields with a single-field mutation, and nothing structural", () => {
    expect([...SCOPED_COMMERCE_FIELD_LABELS].sort()).toEqual(
      ["Compare-at price", "Price", "Product type", "Variant SKU", "Vendor"].sort(),
    );
  });
});

describe("applyCommerceField — SHOPIFY_TO_SYNARAVA (local write)", () => {
  it("writes Vendor to Product.vendor, translating the '—' empty placeholder back to null", async () => {
    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SHOPIFY_TO_SYNARAVA",
      shopifyValue: "—", synaravaValue: "Old Vendor",
    });

    expect(mocks.updateProduct).toHaveBeenCalledWith({ where: { id: "product-1" }, data: { vendor: null } });
    expect(result).toMatchObject({ ok: true });
  });

  it("writes Product type to Product.productType", async () => {
    await applyCommerceField({
      productId: "product-1", label: "Product type", direction: "SHOPIFY_TO_SYNARAVA",
      shopifyValue: "Rings", synaravaValue: "Necklaces",
    });

    expect(mocks.updateProduct).toHaveBeenCalledWith({ where: { id: "product-1" }, data: { productType: "Rings" } });
  });

  it("writes Variant SKU/Price/Compare-at price to the primary (earliest-created) variant", async () => {
    mocks.findFirstVariant.mockResolvedValue({ id: "variant-1" });

    await applyCommerceField({ productId: "product-1", label: "Variant SKU", direction: "SHOPIFY_TO_SYNARAVA", shopifyValue: "SKU-9", synaravaValue: "SKU-1" });
    expect(mocks.findFirstVariant).toHaveBeenCalledWith({ where: { productId: "product-1" }, orderBy: { createdAt: "asc" } });
    expect(mocks.updateVariant).toHaveBeenCalledWith({ where: { id: "variant-1" }, data: { sku: "SKU-9" } });

    await applyCommerceField({ productId: "product-1", label: "Price", direction: "SHOPIFY_TO_SYNARAVA", shopifyValue: "12000", synaravaValue: "9900" });
    expect(mocks.updateVariant).toHaveBeenCalledWith({ where: { id: "variant-1" }, data: { priceCents: 12000 } });

    await applyCommerceField({ productId: "product-1", label: "Compare-at price", direction: "SHOPIFY_TO_SYNARAVA", shopifyValue: "—", synaravaValue: "15000" });
    expect(mocks.updateVariant).toHaveBeenLastCalledWith({ where: { id: "variant-1" }, data: { compareAtCents: null } });
  });

  it("fails cleanly when the product has no variant to update", async () => {
    mocks.findFirstVariant.mockResolvedValue(null);

    const result = await applyCommerceField({
      productId: "product-1", label: "Price", direction: "SHOPIFY_TO_SYNARAVA", shopifyValue: "12000", synaravaValue: "9900",
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("no variant") });
  });

  it("reports a thrown local write error (e.g. a unique SKU collision) as ok:false instead of throwing", async () => {
    mocks.findFirstVariant.mockResolvedValue({ id: "variant-1" });
    mocks.updateVariant.mockRejectedValue(new Error("Unique constraint failed on the fields: (`sku`)"));

    const result = await applyCommerceField({
      productId: "product-1", label: "Variant SKU", direction: "SHOPIFY_TO_SYNARAVA", shopifyValue: "SKU-9", synaravaValue: "SKU-1",
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("Unique constraint") });
  });
});

describe("applyCommerceField — SYNARAVA_TO_SHOPIFY (Shopify write)", () => {
  it("sends a productUpdate mutation with only the changed key for Vendor", async () => {
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({ productUpdate: { product: { id: "gid://shopify/Product/1" }, userErrors: [] } });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY",
      shopifyValue: "Old Vendor", synaravaValue: "New Vendor",
    });

    expect(mocks.request).toHaveBeenCalledTimes(1);
    const [, variables] = mocks.request.mock.calls[0];
    expect(variables).toEqual({ product: { id: "gid://shopify/Product/1", vendor: "New Vendor" } });
    expect(result).toMatchObject({ ok: true });
  });

  it("sends a productVariantsBulkUpdate mutation with only price for Price, using the variant's shopifyVariantId", async () => {
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.findFirstVariant.mockResolvedValue({ id: "variant-1", shopifyVariantId: "gid://shopify/ProductVariant/9" });
    mocks.request.mockResolvedValue({ productVariantsBulkUpdate: { productVariants: [{ id: "gid://shopify/ProductVariant/9" }], userErrors: [] } });

    await applyCommerceField({
      productId: "product-1", label: "Price", direction: "SYNARAVA_TO_SHOPIFY", shopifyValue: "9900", synaravaValue: "12000",
    });

    const [, variables] = mocks.request.mock.calls[0];
    expect(variables).toEqual({
      productId: "gid://shopify/Product/1",
      variants: [{ id: "gid://shopify/ProductVariant/9", price: "120.00" }],
    });
  });

  it("sends SKU through inventoryItem, not a bare sku field", async () => {
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.findFirstVariant.mockResolvedValue({ id: "variant-1", shopifyVariantId: "gid://shopify/ProductVariant/9" });
    mocks.request.mockResolvedValue({ productVariantsBulkUpdate: { productVariants: [{ id: "gid://shopify/ProductVariant/9" }], userErrors: [] } });

    await applyCommerceField({
      productId: "product-1", label: "Variant SKU", direction: "SYNARAVA_TO_SHOPIFY", shopifyValue: "SKU-OLD", synaravaValue: "SKU-NEW",
    });

    const [, variables] = mocks.request.mock.calls[0];
    expect(variables).toEqual({
      productId: "gid://shopify/Product/1",
      variants: [{ id: "gid://shopify/ProductVariant/9", inventoryItem: { sku: "SKU-NEW" } }],
    });
  });

  it("sends null compareAtPrice when clearing it", async () => {
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.findFirstVariant.mockResolvedValue({ id: "variant-1", shopifyVariantId: "gid://shopify/ProductVariant/9" });
    mocks.request.mockResolvedValue({ productVariantsBulkUpdate: { productVariants: [{ id: "gid://shopify/ProductVariant/9" }], userErrors: [] } });

    await applyCommerceField({
      productId: "product-1", label: "Compare-at price", direction: "SYNARAVA_TO_SHOPIFY", shopifyValue: "15000", synaravaValue: "—",
    });

    const [, variables] = mocks.request.mock.calls[0];
    expect(variables).toEqual({
      productId: "gid://shopify/Product/1",
      variants: [{ id: "gid://shopify/ProductVariant/9", compareAtPrice: null }],
    });
  });

  it("fails when the product isn't linked to Shopify", async () => {
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: null });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", shopifyValue: "Old", synaravaValue: "New",
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("not linked") });
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("fails when the variant isn't linked to Shopify", async () => {
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.findFirstVariant.mockResolvedValue({ id: "variant-1", shopifyVariantId: null });

    const result = await applyCommerceField({
      productId: "product-1", label: "Price", direction: "SYNARAVA_TO_SHOPIFY", shopifyValue: "9900", synaravaValue: "12000",
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("variant is not linked") });
  });

  it("surfaces Shopify userErrors as a failed result instead of throwing", async () => {
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.request.mockResolvedValue({ productUpdate: { product: null, userErrors: [{ field: ["vendor"], message: "Vendor can't be blank" }] } });

    const result = await applyCommerceField({
      productId: "product-1", label: "Vendor", direction: "SYNARAVA_TO_SHOPIFY", shopifyValue: "Old", synaravaValue: "",
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("Vendor can't be blank") });
  });
});

describe("applyCommerceField — unsupported field", () => {
  it("refuses a field outside SCOPED_COMMERCE_FIELD_LABELS without touching the network or DB", async () => {
    const result = await applyCommerceField({
      productId: "product-1", label: "Status", direction: "SHOPIFY_TO_SYNARAVA", shopifyValue: "DRAFT", synaravaValue: "ACTIVE",
    });

    expect(result).toMatchObject({ ok: false });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.updateVariant).not.toHaveBeenCalled();
  });
});
