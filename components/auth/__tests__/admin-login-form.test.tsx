import { render, screen } from "@testing-library/react";
import { act } from "react";

const adminLoginActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/admin/login/actions", () => ({
  adminLoginAction: adminLoginActionMock,
}));

import { AdminLoginForm, useRetryAfterCountdown } from "../admin-login-form";

function RetryAfterProbe({ seconds }: { seconds?: number }) {
  const remaining = useRetryAfterCountdown(seconds);

  return <output>{remaining ?? "ready"}</output>;
}

describe("AdminLoginForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders admin login heading", () => {
    render(<AdminLoginForm />);
    expect(screen.getByText("Studio credentials")).toBeInTheDocument();
  });

  it("renders username or email and password fields", () => {
    render(<AdminLoginForm />);
    expect(screen.getByLabelText("Username or email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders the admin submit button", () => {
    render(<AdminLoginForm />);
    expect(screen.getByRole("button", { name: "Enter admin" })).toBeInTheDocument();
  });

  it("includes redirectTo as hidden form data", () => {
    const { container } = render(<AdminLoginForm redirectTo="/admin/products" />);
    expect(container.querySelector('input[name="redirectTo"]')).toHaveValue("/admin/products");
  });

  it("counts down retry-after seconds", () => {
    vi.useFakeTimers();
    render(<RetryAfterProbe seconds={3} />);

    expect(screen.getByText("3")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("2")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
