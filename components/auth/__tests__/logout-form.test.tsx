import { render, screen } from "@testing-library/react";

vi.mock("@/app/admin/login/actions", () => ({
  adminLogoutAction: vi.fn(),
}));

import { LogoutForm } from "../logout-form";

describe("LogoutForm", () => {
  it("renders a Log out button", () => {
    render(<LogoutForm />);
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("button is a submit type inside a form", () => {
    const { container } = render(<LogoutForm />);
    expect(container.querySelector("form")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
