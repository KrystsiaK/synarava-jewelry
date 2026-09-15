import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCustomerProfile: vi.fn(),
  getSession: vi.fn(),
  getWishlistIds: vi.fn(),
  listProducts: vi.fn(),
}));

vi.mock("@/lib/shopify/customer-account/api", () => ({
  getShopifyCustomerProfile: mocks.getCustomerProfile,
}));

vi.mock("@/lib/shopify/customer-account/session", () => ({
  getShopifyCustomerSession: mocks.getSession,
}));

vi.mock("@/lib/shopify/wishlist", () => ({
  getShopifyCustomerWishlistIds: mocks.getWishlistIds,
}));

vi.mock("@/lib/content/catalog", () => ({
  listShopProducts: mocks.listProducts,
}));

vi.mock("@/lib/i18n/server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("@/components/profile/shopify-profile-shell", () => ({
  ShopifyProfileShell: ({ wishlistProducts }: { wishlistProducts: unknown[] }) => (
    <div data-testid="profile" data-wishlist-count={wishlistProducts.length} />
  ),
}));

import ProfilePage from "../page";

describe("ProfilePage", () => {
  beforeEach(() => {
    mocks.getCustomerProfile.mockResolvedValue({ id: "gid://shopify/Customer/1" });
    mocks.getSession.mockResolvedValue({ sessionExpiresAt: new Date("2026-10-15T00:00:00.000Z") });
    mocks.getWishlistIds.mockRejectedValue(
      new Error("Access denied: missing read_customers"),
    );
    mocks.listProducts.mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("keeps the authenticated profile available when optional wishlist access is unavailable", async () => {
    render(await ProfilePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("profile")).toHaveAttribute(
      "data-wishlist-count",
      "0",
    );
    expect(mocks.listProducts).not.toHaveBeenCalled();
  });

  it("loads the profile with the already-resolved customer session", async () => {
    const session = {
      accessToken: "customer-token",
      id: "session-1",
      idToken: "id-token",
      sessionExpiresAt: new Date("2026-10-15T00:00:00.000Z"),
    };
    mocks.getSession.mockResolvedValue(session);

    render(await ProfilePage({ searchParams: Promise.resolve({}) }));

    expect(mocks.getCustomerProfile).toHaveBeenCalledWith(session);
  });
});
