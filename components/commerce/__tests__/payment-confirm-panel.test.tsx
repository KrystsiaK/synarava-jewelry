import { render, screen } from "@testing-library/react";

vi.mock("@/app/checkout/actions", () => ({
  confirmOrderAction: vi.fn(),
  resetCheckoutAction: vi.fn(),
}));

vi.mock("../payment-form", () => ({
  PaymentForm: () => <button type="submit">Pay now</button>,
}));

import { PaymentConfirmPanel } from "../payment-confirm-panel";

const order = {
  customerName: "Katia Smirnova",
  customerEmail: "katia@example.com",
  totalCents: 48000,
  currency: "EUR",
  items: [
    { id: "1", title: "Birch Bracelet", quantity: 2, totalCents: 48000 },
  ],
  shippingAddress: {
    line1: "12 Forest Ave",
    line2: null,
    city: "Minsk",
    region: "Minsk Region",
    postalCode: "220000",
    countryCode: "BY",
  },
};

describe("PaymentConfirmPanel", () => {
  it("renders item title and quantity", () => {
    render(<PaymentConfirmPanel order={order} clientSecret="cs_test_secret" />);
    expect(screen.getByText("Birch Bracelet")).toBeInTheDocument();
    expect(screen.getByText("Qty 2")).toBeInTheDocument();
  });

  it("renders formatted item total", () => {
    render(<PaymentConfirmPanel order={order} clientSecret="cs_test_secret" />);
    expect(screen.getAllByText("€480.00").length).toBeGreaterThan(0);
  });

  it("renders customer name and email", () => {
    render(<PaymentConfirmPanel order={order} clientSecret="cs_test_secret" />);
    expect(screen.getByText("Katia Smirnova")).toBeInTheDocument();
    expect(screen.getByText("katia@example.com")).toBeInTheDocument();
  });

  it("renders address line1 and city", () => {
    render(<PaymentConfirmPanel order={order} clientSecret="cs_test_secret" />);
    expect(screen.getByText("12 Forest Ave")).toBeInTheDocument();
    expect(screen.getByText(/Minsk/)).toBeInTheDocument();
  });

  it("renders line2 when provided", () => {
    const orderWithLine2 = {
      ...order,
      shippingAddress: { ...order.shippingAddress as object, line2: "Apt 4" },
    };
    render(<PaymentConfirmPanel order={orderWithLine2} clientSecret="cs_test_secret" />);
    expect(screen.getByText("Apt 4")).toBeInTheDocument();
  });

  it("does not render line2 when null", () => {
    render(<PaymentConfirmPanel order={order} clientSecret="cs_test_secret" />);
    expect(screen.queryByText("Apt")).not.toBeInTheDocument();
  });

  it("renders Pay now and Back to cart buttons", () => {
    render(<PaymentConfirmPanel order={order} clientSecret="cs_test_secret" />);
    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to cart" })).toBeInTheDocument();
  });

  it("renders formatted order total", () => {
    render(<PaymentConfirmPanel order={order} clientSecret="cs_test_secret" />);
    expect(screen.getAllByText("€480.00").length).toBeGreaterThan(0);
  });
});
