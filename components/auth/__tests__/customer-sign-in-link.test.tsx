import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CustomerSignInLink } from "@/components/auth/customer-sign-in-link";

describe("CustomerSignInLink", () => {
  it("shows the sheen on press and ignores a second click", () => {
    render(<CustomerSignInLink href="#continue" label="Sign in or create account" />);
    const link = screen.getByRole("link", { name: "Sign in or create account" });

    fireEvent.click(link);
    expect(link).toHaveAttribute("aria-busy", "true");
    const repeat = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(repeat);
    expect(repeat.defaultPrevented).toBe(true);
  });
});
