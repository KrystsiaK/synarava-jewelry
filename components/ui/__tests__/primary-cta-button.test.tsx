import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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

import { PrimaryCtaButton } from "../primary-cta-button";

describe("PrimaryCtaButton", () => {
  it("fires onClick exactly once with href and keeps the href", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PrimaryCtaButton href="/checkout" onClick={onClick}>
        Proceed to checkout
      </PrimaryCtaButton>,
    );

    const link = screen.getByRole("link", { name: /Proceed to checkout/i });
    expect(link).toHaveAttribute("href", "/checkout");
    // jsdom cannot navigate; keep the click side-effect under test.
    link.addEventListener("click", (event) => event.preventDefault());

    await user.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
