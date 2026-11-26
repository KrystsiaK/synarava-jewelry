import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pairingFindMany: vi.fn(),
  getProductBySlug: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    productPairing: { findMany: mocks.pairingFindMany },
  },
}));

vi.mock("@/lib/content/catalog", () => ({
  getProductBySlug: mocks.getProductBySlug,
}));

vi.mock("@/lib/s3", () => ({
  getS3PublicUrl: (key: string) => `https://cdn.test/${key}`,
}));

import { listStorefrontPairingPartners } from "@/lib/commerce/product-pairing-partners";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listStorefrontPairingPartners visibility", () => {
  it("skips UNLISTED partners without calling storefront summary when not ACTIVE+PUBLIC", async () => {
    mocks.pairingFindMany.mockResolvedValue([
      {
        id: "pair-1",
        baseProductId: "base",
        addonProductId: "addon",
        sortOrder: 0,
        imageAsset: null,
        baseProduct: { id: "base", slug: "base", status: "ACTIVE", visibility: "PUBLIC" },
        addonProduct: { id: "addon", slug: "addon", status: "UNLISTED", visibility: "UNLISTED" },
      },
    ]);

    const partners = await listStorefrontPairingPartners("base", "en");
    expect(partners).toEqual([]);
    expect(mocks.getProductBySlug).not.toHaveBeenCalled();
  });

  it("includes ACTIVE+PUBLIC partners with a merchandise id", async () => {
    mocks.pairingFindMany.mockResolvedValue([
      {
        id: "pair-1",
        baseProductId: "base",
        addonProductId: "addon",
        sortOrder: 0,
        imageAsset: { key: "uploads/pairings/x.webp" },
        baseProduct: { id: "base", slug: "base", status: "ACTIVE", visibility: "PUBLIC" },
        addonProduct: { id: "addon", slug: "addon", status: "ACTIVE", visibility: "PUBLIC" },
      },
    ]);
    mocks.getProductBySlug.mockResolvedValue({
      slug: "addon",
      sourceSlug: "addon",
      title: "Charm",
      image: "/c.jpg",
      price: "€25.00",
      variantDetails: [{ merchandiseId: "gid://v/1", available: true }],
    });

    const partners = await listStorefrontPairingPartners("base", "pt");
    expect(partners).toHaveLength(1);
    expect(partners[0]?.available).toBe(true);
    expect(mocks.getProductBySlug).toHaveBeenCalledWith("addon", "pt");
  });
});
