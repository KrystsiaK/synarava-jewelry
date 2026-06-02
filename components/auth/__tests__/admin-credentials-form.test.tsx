import { render, screen } from "@testing-library/react";

vi.mock("@/app/admin/account/actions", () => ({
  updateAdminCredentialsAction: vi.fn(),
}));

import { AdminCredentialsForm } from "../admin-credentials-form";

describe("AdminCredentialsForm", () => {
  it("renders Login and password heading", () => {
    render(<AdminCredentialsForm currentEmail="admin@example.com" />);
    expect(screen.getByText("Login and password")).toBeInTheDocument();
  });

  it("pre-fills email field with currentEmail", () => {
    render(<AdminCredentialsForm currentEmail="admin@example.com" />);
    expect(screen.getByDisplayValue("admin@example.com")).toBeInTheDocument();
  });

  it("renders Current password, New password, Confirm new password fields", () => {
    render(<AdminCredentialsForm currentEmail="admin@example.com" />);
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("renders Update credentials button", () => {
    render(<AdminCredentialsForm currentEmail="admin@example.com" />);
    expect(screen.getByRole("button", { name: "Update credentials" })).toBeInTheDocument();
  });
});
