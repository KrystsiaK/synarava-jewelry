import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  variantFindMany: vi.fn(),
  pairingFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    productVariant: { findMany: mocks.variantFindMany },
    productPairing: { findMany: mocks.pairingFindMany },
  },
}));

import { listWornTogetherMerchandiseIdsByMerchandiseIds } from "@/lib/commerce/product-pairings";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listWornTogetherMerchandiseIdsByMerchandiseIds", () => {
  it("returns partner merchandiseIds, never Product.name (ru/pt cart titles stay on lines)", async () => {
    mocks.variantFindMany.mockResolvedValue([
      { shopifyVariantId: "gid://v/base", productId: "p-base" },
      { shopifyVariantId: "gid://v/addon", productId: "p-addon" },
    ]);
    mocks.pairingFindMany.mockResolvedValue([
      { baseProductId: "p-base", addonProductId: "p-addon" },
    ]);

    const map = await listWornTogetherMerchandiseIdsByMerchandiseIds([
      "gid://v/base",
      "gid://v/addon",
    ]);

    expect(map.get("gid://v/base")).toEqual(["gid://v/addon"]);
    expect(map.get("gid://v/addon")).toEqual(["gid://v/base"]);
    // No title/name strings in the payload — labels come from cart line titles.
    expect(JSON.stringify([...map.values()])).not.toMatch(/Necklace|Колье|Colar/i);
  });
});
