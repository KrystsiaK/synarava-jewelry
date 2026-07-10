import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("react-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-dom")>();
  return { ...mod, useFormStatus: vi.fn().mockReturnValue({ pending: false }) };
});

import { AuthSubmitButton } from "../auth-submit-button";
import * as ReactDOM from "react-dom";

describe("AuthSubmitButton", () => {
  const useFormStatus = ReactDOM.useFormStatus as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useFormStatus.mockReturnValue({ pending: false });
  });

  it("renders label when not pending", () => {
    render(<AuthSubmitButton label="Sign in" />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders pendingLabel when pending", () => {
    useFormStatus.mockReturnValue({ pending: true });
    render(<AuthSubmitButton label="Sign in" pendingLabel="Signing in…" />);
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeInTheDocument();
  });

  it("button is disabled when pending", () => {
    useFormStatus.mockReturnValue({ pending: true });
    render(<AuthSubmitButton label="Sign in" />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("button is not disabled when not pending", () => {
    render(<AuthSubmitButton label="Sign in" />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("button is disabled when disabled prop is true", () => {
    render(<AuthSubmitButton label="Sign in" disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("uses default pendingLabel 'Working…'", () => {
    useFormStatus.mockReturnValue({ pending: true });
    render(<AuthSubmitButton label="Sign in" />);
    expect(screen.getByRole("button")).toHaveTextContent("Working…");
  });
});
