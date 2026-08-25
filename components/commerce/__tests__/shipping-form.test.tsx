import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { mockSubmitShippingAction } = vi.hoisted(() => ({
  mockSubmitShippingAction: vi.fn(),
}));

vi.mock("@/app/checkout/actions", () => ({
  submitShippingAction: mockSubmitShippingAction,
}));

import { ShippingForm } from "../shipping-form";

describe("ShippingForm", () => {
  beforeEach(() => {
    mockSubmitShippingAction.mockReset();
    mockSubmitShippingAction.mockResolvedValue({});
  });

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
    expect(screen.getByPlaceholderText("Address line 2 (optional)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("City")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Postal code")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("pre-fills email when defaultEmail provided", () => {
    render(<ShippingForm defaultEmail="user@example.com" />);
    expect(screen.getByDisplayValue("user@example.com")).toBeInTheDocument();
  });

  it("pre-fills name when defaultName provided", () => {
    render(<ShippingForm defaultName="Katia S." />);
    expect(screen.getByDisplayValue("Katia S.")).toBeInTheDocument();
  });

  it("uses Lithuania as default country", () => {
    render(<ShippingForm />);
    expect(screen.getByDisplayValue("Lithuania")).toBeInTheDocument();
  });

  it("renders notes textarea", () => {
    render(<ShippingForm />);
    expect(screen.getByPlaceholderText("Leave at door, gift message, etc.")).toBeInTheDocument();
  });

  it("keeps the form in place, announces errors, and focuses the first invalid field", async () => {
    mockSubmitShippingAction.mockResolvedValue({
      fieldErrors: {
        email: "Enter a valid email address.",
        name: "Enter the recipient’s full name.",
      },
    });
    const { container } = render(<ShippingForm />);

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("Email")).toHaveFocus();
    expect(screen.getByPlaceholderText("Email")).toHaveAttribute("aria-invalid", "true");
  });
});
