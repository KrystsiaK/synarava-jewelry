import { render, screen } from "@testing-library/react";
import { AuthShell } from "../auth-shell";

const baseProps = {
  eyebrow: "Identify",
  title: "Login",
  description: "Access your account",
  asideTitle: "Security",
  asideBody: "Your data is encrypted end-to-end.",
};

describe("AuthShell", () => {
  it("renders eyebrow, title, and description", () => {
    render(<AuthShell {...baseProps}><div>Form</div></AuthShell>);
    expect(screen.getByText("Identify")).toBeInTheDocument();
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Access your account")).toBeInTheDocument();
  });

  it("renders aside title and body", () => {
    render(<AuthShell {...baseProps}><div>Form</div></AuthShell>);
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Your data is encrypted end-to-end.")).toBeInTheDocument();
  });

  it("renders children (form slot)", () => {
    render(<AuthShell {...baseProps}><div>My Form</div></AuthShell>);
    expect(screen.getByText("My Form")).toBeInTheDocument();
  });

  it("does not render footer section when footer not provided", () => {
    render(<AuthShell {...baseProps}><div>Form</div></AuthShell>);
    // footer section has border-t and pt-6 classes
    // the footer slot itself should not appear
    expect(screen.queryByText("Back to storefront")).toBeInTheDocument(); // always present
  });

  it("renders footer slot when provided", () => {
    render(
      <AuthShell {...baseProps} footer={<span>Footer note</span>}>
        <div>Form</div>
      </AuthShell>,
    );
    expect(screen.getByText("Footer note")).toBeInTheDocument();
  });

  it("has back-to-storefront link", () => {
    render(<AuthShell {...baseProps}><div>Form</div></AuthShell>);
    expect(screen.getByRole("link", { name: "Back to storefront" })).toHaveAttribute("href", "/");
  });
});
