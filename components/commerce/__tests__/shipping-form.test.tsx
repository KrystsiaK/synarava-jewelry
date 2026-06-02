import { render, screen } from "@testing-library/react";

vi.mock("@/app/checkout/actions", () => ({
  submitShippingAction: vi.fn(),
}));

import { ShippingForm } from "../shipping-form";

describe("ShippingForm", () => {
  it("renders Continue to payment submit button", () => {
    render(<ShippingForm />);
    expect(screen.getByRole("button", { name: "Continue to payment" })).toBeInTheDocument();
  });

  it("renders email input", () => {
    render(<ShippingForm />);
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
  });

  it("renders full name input", () => {
    render(<ShippingForm />);
    expect(screen.getByPlaceholderText("Full name")).toBeInTheDocument();
  });

  it("renders all address fields", () => {
    render(<ShippingForm />);
    expect(screen.getByPlaceholderText("Address line 1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Address line 2")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("City")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Postal code")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Country code")).toBeInTheDocument();
  });

  it("pre-fills email when defaultEmail provided", () => {
    render(<ShippingForm defaultEmail="user@example.com" />);
    expect(screen.getByDisplayValue("user@example.com")).toBeInTheDocument();
  });

  it("pre-fills name when defaultName provided", () => {
    render(<ShippingForm defaultName="Katia S." />);
    expect(screen.getByDisplayValue("Katia S.")).toBeInTheDocument();
  });

  it("uses LT as default country code", () => {
    render(<ShippingForm />);
    expect(screen.getByDisplayValue("LT")).toBeInTheDocument();
  });

  it("renders notes textarea", () => {
    render(<ShippingForm />);
    expect(screen.getByPlaceholderText("Delivery notes")).toBeInTheDocument();
  });
});
