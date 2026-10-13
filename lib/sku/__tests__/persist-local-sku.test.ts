import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFindFirst,
  mockProductUpdate,
  mockVariantUpdate,
  mockVariantCreate,
  mockFindUniqueOrThrow,
  mockFindUnique,
  mockTransaction,
  mockPatchOurProductWindow,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockProductUpdate: vi.fn(),
  mockVariantUpdate: vi.fn(),
  mockVariantCreate: vi.fn(),
  mockFindUniqueOrThrow: vi.fn(),
  mockFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
  mockPatchOurProductWindow: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mockTransaction,
    product: {
      update: mockProductUpdate,
      findUnique: mockFindUnique,
      findUniqueOrThrow: mockFindUniqueOrThrow,
    },
    productVariant: {
      findFirst: mockFindFirst,
      update: mockVariantUpdate,
      create: mockVariantCreate,
    },
  },
}));

vi.mock("@/lib/commerce-store/refresh", () => ({
  patchOurProductWindow: mockPatchOurProductWindow,
}));

import { persistLocalSku } from "@/lib/sku/persist-local-sku";

describe("persistLocalSku", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        productVariant: {
          findFirst: mockFindFirst,
          update: mockVariantUpdate,
          create: mockVariantCreate,
        },
        product: {
          update: mockProductUpdate,
          findUniqueOrThrow: mockFindUniqueOrThrow,
        },
      };
      return fn(tx);
    });
    mockFindFirst.mockResolvedValue({ id: "var-1" });
    mockProductUpdate.mockResolvedValue({});
    mockVariantUpdate.mockResolvedValue({});
    mockPatchOurProductWindow.mockResolvedValue(undefined);
  });

  it("writes SKU columns and write-throughs workingSnapshot + OUR store", async () => {
    mockFindUnique.mockResolvedValue({
      shopifyProductId: "gid://shopify/Product/1",
      workingSnapshot: {
        title: "Ring",
        variants: [{ id: "gid://shopify/ProductVariant/9", sku: "" }],
      },
      shopifySnapshot: {
        title: "Ring",
        variants: [{ id: "gid://shopify/ProductVariant/9", sku: "" }],
      },
      variants: [{ shopifyVariantId: "gid://shopify/ProductVariant/9" }],
    });

    const result = await persistLocalSku({
      productId: "prod-1",
      variantId: "var-1",
      sku: "JW-NECK-001",
      details: {},
    });

    expect(result).toEqual({ variantId: "var-1" });
    expect(mockVariantUpdate).toHaveBeenCalledWith({
      where: { id: "var-1" },
      data: { sku: "JW-NECK-001" },
    });
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod-1" },
        data: expect.objectContaining({ sku: "JW-NECK-001" }),
      }),
    );
    // Second product.update is the write-through of workingSnapshot
    expect(mockProductUpdate).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data: {
        workingSnapshot: {
          title: "Ring",
          variants: [{ id: "gid://shopify/ProductVariant/9", sku: "JW-NECK-001" }],
        },
      },
    });
    expect(mockPatchOurProductWindow).toHaveBeenCalledWith({
      shopifyProductId: "gid://shopify/Product/1",
      localProductId: "prod-1",
      window: {
        title: "Ring",
        variants: [{ id: "gid://shopify/ProductVariant/9", sku: "JW-NECK-001" }],
      },
    });
  });

  it("skips OUR store patch when product is not Shopify-linked", async () => {
    mockFindUnique.mockResolvedValue({
      shopifyProductId: null,
      workingSnapshot: { title: "Local", variants: [{ sku: "PENDING-p1-v1" }] },
      shopifySnapshot: null,
      variants: [{ shopifyVariantId: null }],
    });

    await persistLocalSku({
      productId: "prod-2",
      variantId: "var-1",
      sku: "JW-NECK-002",
      details: { skuAssignmentPendings: {} },
    });

    expect(mockProductUpdate).toHaveBeenCalledWith({
      where: { id: "prod-2" },
      data: {
        workingSnapshot: {
          title: "Local",
          variants: [{ sku: "JW-NECK-002" }],
        },
      },
    });
    expect(mockPatchOurProductWindow).not.toHaveBeenCalled();
  });
});
