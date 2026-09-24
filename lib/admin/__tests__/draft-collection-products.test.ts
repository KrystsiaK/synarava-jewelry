import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyMembership: vi.fn(),
  updateManyProduct: vi.fn(),
  deleteManyMembership: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    productCollection: {
      findMany: mocks.findManyMembership,
      deleteMany: mocks.deleteManyMembership,
    },
    product: {
      updateMany: mocks.updateManyProduct,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  collectionDraftCascadeNotice,
  draftMemberProductsLocally,
} from "../draft-collection-products";

describe("draftMemberProductsLocally", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (ops: unknown[]) => ops);
    mocks.updateManyProduct.mockReturnValue({ op: "updateMany" });
    mocks.deleteManyMembership.mockReturnValue({ op: "deleteMany" });
  });

  it("no-ops when the collection has no live member products", async () => {
    mocks.findManyMembership.mockResolvedValue([]);

    await expect(draftMemberProductsLocally("col-1")).resolves.toEqual({ draftedProductIds: [] });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("drafts unique member products locally and clears storefront-default membership", async () => {
    mocks.findManyMembership.mockResolvedValue([
      { productId: "p1" },
      { productId: "p1" },
      { productId: "p2" },
    ]);

    await expect(draftMemberProductsLocally("col-1")).resolves.toEqual({
      draftedProductIds: ["p1", "p2"],
    });

    expect(mocks.findManyMembership).toHaveBeenCalledWith({
      where: {
        collectionId: "col-1",
        product: { status: { in: ["ACTIVE", "UNLISTED"] } },
      },
      select: { productId: true },
    });
    expect(mocks.updateManyProduct).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] } },
      data: {
        status: "DRAFT",
        visibility: "PRIVATE",
        publishedAt: null,
      },
    });
    expect(mocks.deleteManyMembership).toHaveBeenCalledWith({
      where: {
        productId: { in: ["p1", "p2"] },
        collection: { isStorefrontDefault: true },
      },
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("collectionDraftCascadeNotice", () => {
  it("returns empty for zero products", () => {
    expect(collectionDraftCascadeNotice(0)).toBe("");
  });

  it("singular and plural notices", () => {
    expect(collectionDraftCascadeNotice(1)).toContain("1 member product");
    expect(collectionDraftCascadeNotice(3)).toContain("3 member products");
  });
});
