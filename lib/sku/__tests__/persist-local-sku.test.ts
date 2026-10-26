import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFindFirst,
  mockProductUpdate,
  mockVariantUpdate,
  mockVariantCreate,
  mockFindUniqueOrThrow,
  mockFindUnique,
  mockTransaction,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockProductUpdate: vi.fn(),
  mockVariantUpdate: vi.fn(),
  mockVariantCreate: vi.fn(),
  mockFindUniqueOrThrow: vi.fn(),
  mockFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
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
  });

  it("writes SKU columns (ADR-0009: no snapshot write-through)", async () => {
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
    expect(mockProductUpdate).toHaveBeenCalledTimes(1);
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod-1" },
        data: expect.objectContaining({ sku: "JW-NECK-001" }),
      }),
    );
    expect(mockProductUpdate.mock.calls[0][0].data).not.toHaveProperty("workingSnapshot");
    expect(mockProductUpdate.mock.calls[0][0].data).not.toHaveProperty("extras");
  });

  it("updates SKU columns when product is not Shopify-linked", async () => {
    await persistLocalSku({
      productId: "prod-2",
      variantId: "var-1",
      sku: "JW-NECK-002",
      details: { skuAssignmentPendings: {} },
    });

    expect(mockProductUpdate).toHaveBeenCalledTimes(1);
    expect(mockProductUpdate).toHaveBeenCalledWith({
      where: { id: "prod-2" },
      data: {
        sku: "JW-NECK-002",
        details: { skuAssignmentPendings: {} },
      },
    });
  });
});
