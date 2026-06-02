import { render, screen } from "@testing-library/react";

vi.mock("@/app/(auth)/actions", () => ({
  requestPasswordResetAction: vi.fn(),
  resetPasswordAction: vi.fn(),
}));

import { PasswordResetRequestForm, PasswordResetConfirmForm } from "../reset-password-form";

describe("PasswordResetRequestForm", () => {
  it("renders Reset password heading", () => {
    render(<PasswordResetRequestForm />);
    expect(screen.getByText("Reset password")).toBeInTheDocument();
  });

  it("renders account email field", () => {
    render(<PasswordResetRequestForm />);
    expect(screen.getByLabelText("Account email")).toBeInTheDocument();
  });

  it("renders Generate reset link button", () => {
    render(<PasswordResetRequestForm />);
    expect(screen.getByRole("button", { name: "Generate reset link" })).toBeInTheDocument();
  });

  it("renders login link", () => {
    render(<PasswordResetRequestForm />);
    expect(screen.getByRole("link", { name: "login" })).toHaveAttribute("href", "/login");
  });
});

describe("PasswordResetConfirmForm", () => {
  it("renders Set a new password heading", () => {
    render(<PasswordResetConfirmForm token="tok123" />);
    expect(screen.getByText("Set a new password")).toBeInTheDocument();
  });

  it("renders hidden token input", () => {
    const { container } = render(<PasswordResetConfirmForm token="tok123" />);
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe("tok123");
  });

  it("renders New password and Confirm new password fields", () => {
    render(<PasswordResetConfirmForm token="tok123" />);
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("renders Update password button", () => {
    render(<PasswordResetConfirmForm token="tok123" />);
    expect(screen.getByRole("button", { name: "Update password" })).toBeInTheDocument();
  });
});
