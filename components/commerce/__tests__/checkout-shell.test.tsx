import { render, screen } from "@testing-library/react";
import { CheckoutShell } from "../checkout-shell";

const base = {
  eyebrow: "Step 1",
  title: "Shipping Details",
  description: "Tell us where to deliver",
};

describe("CheckoutShell", () => {
  it("renders eyebrow, title, and description", () => {
    render(<CheckoutShell {...base} step="shipping"><p>Form</p></CheckoutShell>);
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shipping Details" })).toBeInTheDocument();
    expect(screen.getByText("Tell us where to deliver")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(<CheckoutShell {...base} step="shipping"><p>Child content</p></CheckoutShell>);
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders aside when provided", () => {
    render(
      <CheckoutShell {...base} step="shipping" aside={<p>Aside content</p>}>
        <p>Form</p>
      </CheckoutShell>,
    );
    expect(screen.getByText("Aside content")).toBeInTheDocument();
  });

  it("does not render aside slot when omitted", () => {
    const { container } = render(<CheckoutShell {...base} step="shipping"><p>Form</p></CheckoutShell>);
    expect(container.querySelectorAll("section")).toHaveLength(1);
  });

  it("renders all three step labels", () => {
    render(<CheckoutShell {...base} step="shipping"><p>Form</p></CheckoutShell>);
    expect(screen.getByText("Acquisition Details")).toBeInTheDocument();
    expect(screen.getByText("Secure Acquisition")).toBeInTheDocument();
    expect(screen.getByText("Acquisition Confirmed")).toBeInTheDocument();
  });

  it("marks shipping step as active when step=shipping", () => {
    render(<CheckoutShell {...base} step="shipping"><p>Form</p></CheckoutShell>);
    const shippingBadge = screen.getByText("Acquisition Details");
    expect(shippingBadge.className).toContain("border-foreground");
  });

  it("marks shipping as done and payment as active when step=payment", () => {
    render(<CheckoutShell {...base} step="payment"><p>Form</p></CheckoutShell>);
    const shippingBadge = screen.getByText("Acquisition Details");
    const paymentBadge = screen.getByText("Secure Acquisition");
    expect(paymentBadge.className).toContain("border-foreground");
    expect(shippingBadge.className).toContain("text-accent");
  });

  it("marks shipping and payment as done when step=confirmed", () => {
    render(<CheckoutShell {...base} step="confirmed"><p>Form</p></CheckoutShell>);
    const shippingBadge = screen.getByText("Acquisition Details");
    const paymentBadge = screen.getByText("Secure Acquisition");
    const confirmedBadge = screen.getByText("Acquisition Confirmed");
    expect(confirmedBadge.className).toContain("border-foreground");
    expect(shippingBadge.className).toContain("text-accent");
    expect(paymentBadge.className).toContain("text-accent");
  });

  it("renders with step=error without crashing", () => {
    render(<CheckoutShell {...base} step="error"><p>Error</p></CheckoutShell>);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
