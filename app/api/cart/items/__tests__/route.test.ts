import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getTrustedClientIp: vi.fn(),
  addStorefrontProductToCart: vi.fn(),
  getStorefrontCartViewModel: vi.fn(),
  revalidateStorefrontPath: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/security/request-ip", () => ({ getTrustedClientIp: mocks.getTrustedClientIp }));
vi.mock("@/lib/commerce/storefront-cart", () => ({
  addStorefrontProductToCart: mocks.addStorefrontProductToCart,
  getStorefrontCartViewModel: mocks.getStorefrontCartViewModel,
}));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: mocks.revalidateStorefrontPath,
}));

import { POST } from "../route";

function postRequest(body: unknown) {
  return new Request("https://synarava.com/api/cart/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/cart/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    mocks.getTrustedClientIp.mockReturnValue("127.0.0.1");
    mocks.addStorefrontProductToCart.mockResolvedValue({ warnings: [] });
    mocks.getStorefrontCartViewModel.mockResolvedValue({
      itemCount: 1,
      currency: "EUR",
      subtotalCents: 1000,
      items: [],
    });
  });

  it("revalidates cart, shop, and root layout after a successful add", async () => {
    const response = await POST(postRequest({ productSlug: "birch-bracelet", quantity: 1 }));
    expect(response.status).toBe(200);
    expect(mocks.revalidateStorefrontPath).toHaveBeenCalledWith("/cart");
    expect(mocks.revalidateStorefrontPath).toHaveBeenCalledWith("/shop");
    expect(mocks.revalidateStorefrontPath).toHaveBeenCalledWith("/", "layout");
  });
});
