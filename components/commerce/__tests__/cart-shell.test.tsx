import { render, screen } from "@testing-library/react";

vi.mock("@/lib/i18n/context", () => ({
  useTranslations: () => ({
    t: (key: string) => key,
    locale: "en",
  }),
}));

vi.mock("@/lib/i18n/routing", () => ({
  localePath: (locale: string, path: string) => `/${locale}${path}`,
}));

import { CartShell } from "../cart-shell";

const baseProps = {
  items: [],
  itemCount: 0,
  subtotalCents: 0,
  subtotal: "€0",
  currency: "EUR",
};

describe("CartShell account navigation", () => {
  it("shows a locale-aware link back to the account for a signed-in customer", () => {
    render(<CartShell {...baseProps} isSignedIn />);
    const link = screen.getByRole("link", { name: "cart.backToAccount" });
    expect(link).toHaveAttribute("href", "/en/profile");
  });

  it("does not show the account link for a guest", () => {
    render(<CartShell {...baseProps} isSignedIn={false} />);
    expect(screen.queryByRole("link", { name: "cart.backToAccount" })).not.toBeInTheDocument();
  });
});
