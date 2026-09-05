import { render, screen } from "@testing-library/react";

import LoginPage from "../page";

describe("LoginPage", () => {
  it("starts Shopify OAuth with a navigation instead of a CSP-restricted form submission", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ redirectTo: "/profile?tab=orders" }),
      }),
    );

    expect(
      screen.getByRole("link", { name: "Sign in or create account" }),
    ).toHaveAttribute(
      "href",
      "/api/auth/shopify?returnTo=%2Fprofile%3Ftab%3Dorders",
    );
    expect(screen.queryByRole("button", { name: "Sign in or create account" })).not.toBeInTheDocument();
  });
});
