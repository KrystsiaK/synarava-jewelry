import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  cookieValue: null as string | null,
  findUnique: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => (mocks.cookieValue ? { value: mocks.cookieValue } : undefined)),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("@/lib/db", () => ({
  db: { order: { findUnique: mocks.findUnique } },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/commerce/cart", () => ({
  clearActiveCart: vi.fn(),
  getCartViewModel: vi.fn(),
  getOrCreateCart: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
  isStripePaymentConfigured: vi.fn(() => false),
}));

import { getCheckoutOrder } from "@/lib/commerce/checkout";

const token = "a".repeat(64);
const tokenHash = createHash("sha256").update(token).digest("hex");

describe("checkout cookie authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieValue = null;
    mocks.getCurrentUser.mockResolvedValue(null);
  });

  it("rejects a client-supplied order id without its secret token", async () => {
    mocks.cookieValue = "order-1";
    expect(await getCheckoutOrder()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a valid token when the order belongs to another user", async () => {
    mocks.cookieValue = `order-1.${token}`;
    mocks.getCurrentUser.mockResolvedValue({ id: "user-2" });
    mocks.findUnique.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      checkoutAccessTokenHash: tokenHash,
    });

    expect(await getCheckoutOrder()).toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledOnce();
  });

  it("loads an order only for the matching owner and token", async () => {
    const order = { id: "order-1", userId: "user-1", status: "DRAFT", items: [] };
    mocks.cookieValue = `order-1.${token}`;
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.findUnique
      .mockResolvedValueOnce({
        id: "order-1",
        userId: "user-1",
        checkoutAccessTokenHash: tokenHash,
      })
      .mockResolvedValueOnce(order);

    expect(await getCheckoutOrder()).toEqual(order);
    expect(mocks.findUnique.mock.calls[1]?.[0]?.include).not.toHaveProperty("user");
  });
});
