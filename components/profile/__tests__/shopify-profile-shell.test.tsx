import { render, screen } from "@testing-library/react";

vi.mock("@/lib/i18n/context", () => ({
  useTranslations: () => ({ locale: "en" }),
}));

import { ShopifyProfileShell } from "../shopify-profile-shell";
import type { ShopifyCustomerProfile } from "@/lib/shopify/customer-account/api";

const customer = {
  id: "gid://shopify/Customer/1",
  displayName: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  creationDate: "2026-01-01T00:00:00.000Z",
  imageUrl: "",
  emailAddress: { emailAddress: "jane@example.com" },
  defaultAddress: null,
  addresses: { nodes: [] },
  orders: { nodes: [] },
} as unknown as ShopifyCustomerProfile;

describe("ShopifyProfileShell security tab", () => {
  it("labels the tab Sign-in & security instead of the bare Security slug", () => {
    render(
      <ShopifyProfileShell
        customer={customer}
        activeTab="security"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    expect(screen.getByRole("tab", { name: /sign-in & security/i })).toBeInTheDocument();
  });

  it("explains the sign-in is Shopify-managed and unrelated to a browser Google account", () => {
    render(
      <ShopifyProfileShell
        customer={customer}
        activeTab="security"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    expect(screen.getByText(/managed entirely by Shopify/i)).toBeInTheDocument();
    expect(screen.getByText(/separate from any Google account/i)).toBeInTheDocument();
  });

  it("shows the current session's remaining lifetime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T00:00:00.000Z"));
    render(
      <ShopifyProfileShell
        customer={customer}
        activeTab="security"
        wishlistProducts={[]}
        sessionExpiresAt="2026-09-25T00:00:00.000Z"
      />,
    );

    expect(screen.getByText(/asked to sign in again in 10 days/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("submits sign-out to the Shopify logout endpoint", () => {
    render(
      <ShopifyProfileShell
        customer={customer}
        activeTab="security"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    const form = screen.getByRole("button", { name: /sign out on this device/i }).closest("form");
    expect(form).toHaveAttribute("action", "/api/auth/shopify/logout");
  });
});
