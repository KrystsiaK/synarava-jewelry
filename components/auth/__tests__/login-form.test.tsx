import { render, screen } from "@testing-library/react";

vi.mock("@/app/(auth)/actions", () => ({
  loginAction: vi.fn(),
}));

import { LoginForm } from "../login-form";

describe("LoginForm", () => {
  it("renders Login heading", () => {
    render(<LoginForm />);
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("renders email and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders Sign in submit button", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders Forgot password link", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: "Forgot password" })).toHaveAttribute("href", "/reset-password");
  });

  it("renders Create one link", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute("href", "/register");
  });

  it("shows error passed via prop", () => {
    render(<LoginForm error="Session expired" />);
    expect(screen.getByText("Session expired")).toBeInTheDocument();
  });
});
