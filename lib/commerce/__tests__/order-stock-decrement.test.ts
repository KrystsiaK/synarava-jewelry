import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    productVariant: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

import {
  decrementStockForPaidOrderLines,
  paidOrderStockLinesFromPayload,
} from "../order-stock-decrement";

describe("paidOrderStockLinesFromPayload", () => {
  it("aggregates quantities by variant and skips invalid rows", () => {
    expect(
      paidOrderStockLinesFromPayload({
        line_items: [
          { variant_id: 10, quantity: 2 },
          { variant_id: "10", quantity: 1 },
          { variant_id: 11, quantity: 3 },
          { variant_id: null, quantity: 5 },
          { variant_id: 12, quantity: 0 },
          { quantity: 1 },
        ],
      }),
    ).toEqual([
      { shopifyVariantId: "gid://shopify/ProductVariant/10", quantity: 3 },
      { shopifyVariantId: "gid://shopify/ProductVariant/11", quantity: 3 },
    ]);
  });

  it("returns empty when line_items is missing", () => {
    expect(paidOrderStockLinesFromPayload({})).toEqual([]);
  });
});

describe("decrementStockForPaidOrderLines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("decrements by line quantity", async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: "v1", stockOnHand: 5 });
    mocks.update.mockResolvedValueOnce({});

    await expect(
      decrementStockForPaidOrderLines([
        { shopifyVariantId: "gid://shopify/ProductVariant/1", quantity: 2 },
      ]),
    ).resolves.toEqual({ decremented: 1, ignored: 0 });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { stockOnHand: 3 },
    });
  });

  it("floors at zero", async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: "v1", stockOnHand: 2 });
    mocks.update.mockResolvedValueOnce({});

    await decrementStockForPaidOrderLines([
      { shopifyVariantId: "gid://shopify/ProductVariant/1", quantity: 9 },
    ]);

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { stockOnHand: 0 },
    });
  });

  it("ignores unknown variants", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);

    await expect(
      decrementStockForPaidOrderLines([
        { shopifyVariantId: "gid://shopify/ProductVariant/missing", quantity: 1 },
      ]),
    ).resolves.toEqual({ decremented: 0, ignored: 1 });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not write when already at zero", async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: "v1", stockOnHand: 0 });

    await expect(
      decrementStockForPaidOrderLines([
        { shopifyVariantId: "gid://shopify/ProductVariant/1", quantity: 1 },
      ]),
    ).resolves.toEqual({ decremented: 1, ignored: 0 });

    expect(mocks.update).not.toHaveBeenCalled();
  });
});
