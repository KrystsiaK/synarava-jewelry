import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  COMMERCE_EVENT_NAME,
  type CommerceEventDetail,
} from "@/lib/analytics/commerce";

vi.mock("motion/react", async () => {
  const React = await import("react");

  type AnyProps = Record<string, unknown> & {
    children?: React.ReactNode;
    style?: unknown;
    whileTap?: unknown;
  };

  function stripMotionProps(props: AnyProps) {
    const { style: _s, whileTap: _w, ...rest } = props;
    void _s;
    void _w;
    return rest;
  }

  const motion = {
    create(Component: React.ElementType) {
      return React.forwardRef(function MotionCreated(props: AnyProps, ref: React.Ref<unknown>) {
        return React.createElement(Component, { ...stripMotionProps(props), ref });
      });
    },
    button: React.forwardRef(function MotionButton(props: AnyProps, ref: React.Ref<HTMLButtonElement>) {
      return React.createElement("button", { ...stripMotionProps(props), ref });
    }),
  };

  return {
    motion,
    useMotionValue: () => ({ set: vi.fn(), get: () => 0 }),
    useSpring: <T,>(value: T) => value,
  };
});

import { CartSummaryPanel } from "../cart-summary-panel";

describe("CartSummaryPanel", () => {
  const base = { itemCount: 2, subtotal: "€480" };

  it("renders item count and subtotal", () => {
    render(<CartSummaryPanel {...base} />);
    expect(screen.getByText("2 products")).toBeInTheDocument();
    expect(screen.getByText("€480")).toBeInTheDocument();
  });

  it("renders CTA link when ctaHref and ctaLabel provided", () => {
    render(<CartSummaryPanel {...base} ctaHref="/checkout" ctaLabel="Proceed to checkout" />);
    const link = screen.getByRole("link", { name: "Proceed to checkout" });
    expect(link).toHaveAttribute("href", "/checkout");
  });

  it("does not render CTA when ctaHref is missing", () => {
    render(<CartSummaryPanel {...base} ctaLabel="Proceed" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not render CTA when ctaLabel is missing", () => {
    render(<CartSummaryPanel {...base} ctaHref="/checkout" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders note when provided", () => {
    render(<CartSummaryPanel {...base} note="Free shipping on orders over €300" />);
    expect(screen.getByText("Free shipping on orders over €300")).toBeInTheDocument();
  });

  it("does not render note when omitted", () => {
    render(<CartSummaryPanel {...base} />);
    expect(screen.queryByText(/shipping/)).not.toBeInTheDocument();
  });

  it("dispatches synarava:commerce-event begin_checkout when CTA is clicked", async () => {
    const user = userEvent.setup();
    const listener = vi.fn<(event: Event) => void>();
    window.addEventListener(COMMERCE_EVENT_NAME, listener);

    const ecommerce = {
      currency: "EUR",
      value: 480,
      items: [{ item_id: "sku-1", item_name: "Ring", quantity: 2, price: 240 }],
    };

    render(
      <CartSummaryPanel
        {...base}
        ctaHref="/checkout"
        ctaLabel="Proceed to checkout"
        ecommerce={ecommerce}
      />,
    );

    const link = screen.getByRole("link", { name: /Proceed to checkout/i });
    // jsdom cannot navigate; keep the analytics side-effect under test.
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent<CommerceEventDetail>).detail;
    expect(detail.event).toBe("begin_checkout");
    expect(detail.properties).toMatchObject({
      ecommerce,
      metadata: { source: "cart_summary", itemCount: 2 },
    });

    window.removeEventListener(COMMERCE_EVENT_NAME, listener);
  });
});
