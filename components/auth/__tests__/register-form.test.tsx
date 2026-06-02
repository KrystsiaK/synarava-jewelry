import { render, screen } from "@testing-library/react";

vi.mock("@/app/(auth)/actions", () => ({
  registerAction: vi.fn(),
}));

import { RegisterForm } from "../register-form";

describe("RegisterForm", () => {
  it("renders Register heading", () => {
    render(<RegisterForm />);
    expect(screen.getByText("Register")).toBeInTheDocument();
  });

  it("renders Name, Email, Password, Confirm password fields", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("renders Create account submit button", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("renders Sign in link", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
