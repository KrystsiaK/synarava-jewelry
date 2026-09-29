import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStorefrontCheckoutUrl: vi.fn(),
  getRequestLocale: vi.fn(),
  getServerTranslations: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/commerce/storefront-cart", () => ({
  getStorefrontCheckoutUrl: mocks.getStorefrontCheckoutUrl,
}));
vi.mock("@/lib/i18n/server", () => ({
  getRequestLocale: mocks.getRequestLocale,
  getServerTranslations: mocks.getServerTranslations,
}));
vi.mock("@/lib/i18n/routing", () => ({
  localePath: (locale: string, path: string) => `/${locale}${path}`,
}));
vi.mock("@/components/ui", () => ({
  DisplayHeading: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  PrimaryCtaButton: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { render, screen } from "@testing-library/react";

import CheckoutPage from "../page";

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestLocale.mockResolvedValue("en");
    mocks.getServerTranslations.mockResolvedValue({
      t: (key: string) => key,
      locale: "en",
    });
  });

  it("redirects to the Shopify checkout URL when available", async () => {
    mocks.getStorefrontCheckoutUrl.mockResolvedValue("https://checkout.example/c/1?sso=silent");
    await expect(CheckoutPage()).rejects.toThrow("REDIRECT:https://checkout.example/c/1?sso=silent");
  });

  it("shows a clear alert instead of silently bouncing to cart when checkout is unavailable", async () => {
    mocks.getStorefrontCheckoutUrl.mockResolvedValue(null);
    const ui = await CheckoutPage();
    render(ui);
    expect(screen.getByRole("alert")).toHaveTextContent("checkout.unavailableBody");
    expect(screen.getByRole("link", { name: "checkout.unavailableBackToCart" })).toHaveAttribute(
      "href",
      "/en/cart",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
