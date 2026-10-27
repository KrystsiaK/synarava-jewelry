import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $executeRaw: mocks.executeRaw,
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

  it("decrements by line quantity via one atomic UPDATE", async () => {
    mocks.executeRaw.mockResolvedValueOnce(1);

    await expect(
      decrementStockForPaidOrderLines([
        { shopifyVariantId: "gid://shopify/ProductVariant/1", quantity: 2 },
      ]),
    ).resolves.toEqual({ decremented: 1, ignored: 0 });

    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    const [strings, qty, variantId] = mocks.executeRaw.mock.calls[0];
    expect(String.raw({ raw: strings } as TemplateStringsArray)).toContain("GREATEST");
    expect(qty).toBe(2);
    expect(variantId).toBe("gid://shopify/ProductVariant/1");
  });

  it("floors at zero (GREATEST still updates the matching row)", async () => {
    mocks.executeRaw.mockResolvedValueOnce(1);

    await expect(
      decrementStockForPaidOrderLines([
        { shopifyVariantId: "gid://shopify/ProductVariant/1", quantity: 9 },
      ]),
    ).resolves.toEqual({ decremented: 1, ignored: 0 });

    const [, qty] = mocks.executeRaw.mock.calls[0];
    expect(qty).toBe(9);
  });

  it("ignores unknown variants when UPDATE matches zero rows", async () => {
    mocks.executeRaw.mockResolvedValueOnce(0);

    await expect(
      decrementStockForPaidOrderLines([
        { shopifyVariantId: "gid://shopify/ProductVariant/missing", quantity: 1 },
      ]),
    ).resolves.toEqual({ decremented: 0, ignored: 1 });
  });

  it("still runs the atomic UPDATE when stock is already zero", async () => {
    mocks.executeRaw.mockResolvedValueOnce(1);

    await expect(
      decrementStockForPaidOrderLines([
        { shopifyVariantId: "gid://shopify/ProductVariant/1", quantity: 1 },
      ]),
    ).resolves.toEqual({ decremented: 1, ignored: 0 });

    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
  });

  it("applies both decrements when two paid orders race on the same variant", async () => {
    const stock = new Map<string, number>([["gid://shopify/ProductVariant/1", 5]]);
    // Serialize per-variant like a row lock so concurrent GREATEST updates compose.
    let gate = Promise.resolve();
    const tx = {
      $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
        const qty = values[0] as number;
        const id = values[1] as string;
        const run = async () => {
          expect(String.raw({ raw: strings } as TemplateStringsArray)).toContain("GREATEST");
          const current = stock.get(id);
          if (current === undefined) return 0;
          stock.set(id, Math.max(0, current - qty));
          return 1;
        };
        const next = gate.then(run, run);
        gate = next.then(
          () => undefined,
          () => undefined,
        );
        return next;
      },
    };

    const line = { shopifyVariantId: "gid://shopify/ProductVariant/1", quantity: 2 };
    const [a, b] = await Promise.all([
      decrementStockForPaidOrderLines([line], tx),
      decrementStockForPaidOrderLines([line], tx),
    ]);

    expect(a).toEqual({ decremented: 1, ignored: 0 });
    expect(b).toEqual({ decremented: 1, ignored: 0 });
    expect(stock.get("gid://shopify/ProductVariant/1")).toBe(1);
  });
});
