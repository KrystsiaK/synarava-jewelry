import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyMembership: vi.fn(),
  deleteManyMembership: vi.fn(),
  createMembership: vi.fn(),
  findFirstCollection: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    productCollection: {
      findMany: mocks.findManyMembership,
      deleteMany: mocks.deleteManyMembership,
      create: mocks.createMembership,
    },
    collection: { findFirst: mocks.findFirstCollection },
  },
}));

import {
  syncDepartmentCollectionMembership,
  syncScopedCollectionMembership,
  syncStorefrontPriorityMembership,
} from "../collection-membership-sync";

describe("syncScopedCollectionMembership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves an already-correct membership untouched, preserving its sortOrder", async () => {
    mocks.findManyMembership.mockResolvedValue([{ id: "row-1", collectionId: "collection-a" }]);

    await syncScopedCollectionMembership("product-1", { isPrimaryNav: true }, "collection-a");

    expect(mocks.deleteManyMembership).not.toHaveBeenCalled();
    expect(mocks.createMembership).not.toHaveBeenCalled();
  });

  it("replaces a stale membership without deleting memberships outside its scope", async () => {
    mocks.findManyMembership.mockResolvedValue([{ id: "row-1", collectionId: "collection-old" }]);

    await syncScopedCollectionMembership("product-1", { isPrimaryNav: true }, "collection-new");

    expect(mocks.findManyMembership).toHaveBeenCalledWith({
      where: { productId: "product-1", collection: { isPrimaryNav: true } },
      select: { id: true, collectionId: true },
    });
    expect(mocks.deleteManyMembership).toHaveBeenCalledWith({ where: { id: { in: ["row-1"] } } });
    expect(mocks.createMembership).toHaveBeenCalledWith({
      data: { productId: "product-1", collectionId: "collection-new" },
    });
  });

  it("clears the membership when no target collection applies", async () => {
    mocks.findManyMembership.mockResolvedValue([{ id: "row-1", collectionId: "collection-a" }]);

    await syncScopedCollectionMembership("product-1", { isPrimaryNav: true }, null);

    expect(mocks.deleteManyMembership).toHaveBeenCalledWith({ where: { id: { in: ["row-1"] } } });
    expect(mocks.createMembership).not.toHaveBeenCalled();
  });
});

describe("syncStorefrontPriorityMembership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("joins the flagged storefront-default collection once published", async () => {
    mocks.findFirstCollection.mockResolvedValue({ id: "global-collection" });
    mocks.findManyMembership.mockResolvedValue([]);

    await syncStorefrontPriorityMembership("product-1", true);

    expect(mocks.findFirstCollection).toHaveBeenCalledWith({
      where: { isStorefrontDefault: true },
      select: { id: true },
    });
    expect(mocks.createMembership).toHaveBeenCalledWith({
      data: { productId: "product-1", collectionId: "global-collection" },
    });
  });

  it("does not look up the storefront-default collection for an unpublished product", async () => {
    mocks.findManyMembership.mockResolvedValue([]);

    await syncStorefrontPriorityMembership("product-1", false);

    expect(mocks.findFirstCollection).not.toHaveBeenCalled();
    expect(mocks.createMembership).not.toHaveBeenCalled();
  });
});

describe("syncDepartmentCollectionMembership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves the department slug scoped to isPrimaryNav collections only", async () => {
    mocks.findFirstCollection.mockResolvedValue({ id: "dept-rings" });
    mocks.findManyMembership.mockResolvedValue([]);

    await syncDepartmentCollectionMembership("product-1", "rings");

    expect(mocks.findFirstCollection).toHaveBeenCalledWith({
      where: { slug: "rings", isPrimaryNav: true },
      select: { id: true },
    });
    expect(mocks.createMembership).toHaveBeenCalledWith({
      data: { productId: "product-1", collectionId: "dept-rings" },
    });
  });
});
