import { render, screen } from "@testing-library/react";

import { AdminButton } from "../admin-button";

describe("AdminButton", () => {
  it("applies the shared primary chrome by default", () => {
    render(<AdminButton>Save</AdminButton>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("adm-btn-primary");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-component", "AdminButton");
  });

  it.each([
    ["primary", "adm-btn-primary"],
    ["secondary", "adm-btn-secondary"],
    ["ghost", "adm-btn-ghost"],
    ["danger", "adm-btn-danger"],
  ] as const)("maps variant %s to %s", (variant, className) => {
    render(<AdminButton variant={variant}>{variant}</AdminButton>);
    expect(screen.getByRole("button", { name: variant })).toHaveClass(className);
  });

  it("honors disabled", () => {
    render(<AdminButton disabled>Save</AdminButton>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("busy disables the control and sets aria-busy", () => {
    render(<AdminButton busy>Saving…</AdminButton>);

    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("data-busy", "true");
  });

  it("renders a leading icon before the label", () => {
    render(
      <AdminButton leadingIcon={<span data-testid="icon">★</span>}>
        Push
      </AdminButton>,
    );

    const button = screen.getByRole("button", { name: "★ Push" });
    expect(button.firstChild).toHaveAttribute("data-testid", "icon");
  });
});
