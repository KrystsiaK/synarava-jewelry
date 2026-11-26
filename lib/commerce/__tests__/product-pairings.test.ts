import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  imageFindUnique: vi.fn(),
  imageCreate: vi.fn(),
  imageDelete: vi.fn(),
  imageCount: vi.fn(),
  imageFindMany: vi.fn(),
  imageUpdate: vi.fn(),
  imageAggregate: vi.fn(),
  mediaFindUnique: vi.fn(),
  mediaDelete: vi.fn(),
  deleteStoredGalleryObject: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    productPairing: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      create: mocks.create,
      update: mocks.update,
      delete: mocks.delete,
      count: mocks.count,
      aggregate: mocks.aggregate,
    },
    productPairingImage: {
      findUnique: mocks.imageFindUnique,
      findMany: mocks.imageFindMany,
      create: mocks.imageCreate,
      delete: mocks.imageDelete,
      count: mocks.imageCount,
      update: mocks.imageUpdate,
      aggregate: mocks.imageAggregate,
    },
    mediaAsset: {
      findUnique: mocks.mediaFindUnique,
      delete: mocks.mediaDelete,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/products/gallery", () => ({
  deleteStoredGalleryObject: mocks.deleteStoredGalleryObject,
}));

import {
  assertPairingAllowed,
  createProductPairing,
  deleteProductPairing,
  deleteProductPairingImage,
  pairingExistsBetween,
  ProductPairingError,
} from "@/lib/commerce/product-pairings";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assertPairingAllowed", () => {
  it("forbids self-link", async () => {
    await expect(assertPairingAllowed("p1", "p1")).rejects.toThrow(ProductPairingError);
    await expect(assertPairingAllowed("p1", "p1")).rejects.toThrow(/itself/i);
  });

  it("forbids base that is already an addon", async () => {
    mocks.findFirst
      .mockResolvedValueOnce({ id: "existing-as-addon" }) // base used as addon
      .mockResolvedValueOnce(null);
    await expect(assertPairingAllowed("charm", "necklace")).rejects.toThrow(/already an addon/i);
  });

  it("forbids addon that is already a base", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(null) // base not an addon
      .mockResolvedValueOnce({ id: "existing-as-base" }); // addon used as base
    await expect(assertPairingAllowed("necklace", "other-necklace")).rejects.toThrow(/already a base/i);
  });

  it("forbids duplicate pair", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.findUnique.mockResolvedValue({ id: "dup" });
    await expect(assertPairingAllowed("necklace", "charm")).rejects.toThrow(/already exists/i);
  });

  it("allows a new valid link", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.findUnique.mockResolvedValue(null);
    await expect(assertPairingAllowed("necklace", "charm")).resolves.toBeUndefined();
  });
});

describe("createProductPairing", () => {
  it("persists after validation without a single image column", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({
      id: "pair-1",
      baseProductId: "necklace",
      addonProductId: "charm",
      sortOrder: 0,
    });

    const row = await createProductPairing({
      baseProductId: "necklace",
      addonProductId: "charm",
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        baseProductId: "necklace",
        addonProductId: "charm",
        sortOrder: 0,
      },
    });
    expect(row.id).toBe("pair-1");
  });
});

describe("deleteProductPairing", () => {
  it("removes orphan pair photo assets only", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "pair-1",
      images: [
        {
          imageAssetId: "asset-1",
          imageAsset: { id: "asset-1", key: "uploads/pairings/a.webp" },
        },
      ],
    });
    mocks.delete.mockResolvedValue({});
    mocks.imageCount.mockResolvedValue(0);
    mocks.mediaDelete.mockResolvedValue({});
    mocks.deleteStoredGalleryObject.mockResolvedValue(undefined);

    await deleteProductPairing("pair-1");

    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: "pair-1" } });
    expect(mocks.deleteStoredGalleryObject).toHaveBeenCalledWith("uploads/pairings/a.webp");
    expect(mocks.mediaDelete).toHaveBeenCalledWith({ where: { id: "asset-1" } });
  });

  it("keeps the asset when another pairing image still references it", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "pair-1",
      images: [
        {
          imageAssetId: "asset-1",
          imageAsset: { id: "asset-1", key: "uploads/pairings/a.webp" },
        },
      ],
    });
    mocks.delete.mockResolvedValue({});
    mocks.imageCount.mockResolvedValue(1);

    await deleteProductPairing("pair-1");

    expect(mocks.deleteStoredGalleryObject).not.toHaveBeenCalled();
    expect(mocks.mediaDelete).not.toHaveBeenCalled();
  });
});

describe("deleteProductPairingImage", () => {
  it("deletes one photo and cleans an orphan asset", async () => {
    mocks.imageFindUnique.mockResolvedValue({
      id: "img-1",
      imageAssetId: "asset-1",
      imageAsset: { id: "asset-1", key: "uploads/pairings/a.webp" },
    });
    mocks.imageDelete.mockResolvedValue({});
    mocks.imageCount.mockResolvedValue(0);
    mocks.mediaDelete.mockResolvedValue({});
    mocks.deleteStoredGalleryObject.mockResolvedValue(undefined);

    await deleteProductPairingImage("img-1");

    expect(mocks.imageDelete).toHaveBeenCalledWith({ where: { id: "img-1" } });
    expect(mocks.deleteStoredGalleryObject).toHaveBeenCalledWith("uploads/pairings/a.webp");
  });
});

describe("pairingExistsBetween", () => {
  it("is true for either direction", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "pair-1" });
    await expect(pairingExistsBetween("a", "b")).resolves.toBe(true);

    mocks.findFirst.mockResolvedValueOnce(null);
    await expect(pairingExistsBetween("a", "b")).resolves.toBe(false);
  });
});
