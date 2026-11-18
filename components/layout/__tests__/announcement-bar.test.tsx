import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF } from "@/lib/content/announcement-bar-display";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("AnnouncementBar", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("renders nothing when disabled", () => {
    const { container } = render(
      <AnnouncementBar
        enabled={false}
        threshold={{ amount: "45.0", currencyCode: "EUR" }}
        template="Free shipping from {amount}"
        locale="en"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing without a threshold", () => {
    const { container } = render(
      <AnnouncementBar
        enabled
        threshold={null}
        template="Free shipping from {amount}"
        locale="en"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes banner text via static content (no region aria-label) and aria-hides marquee", () => {
    render(
      <AnnouncementBar
        enabled
        threshold={{ amount: "45.0", currencyCode: "EUR" }}
        template="Free shipping in Portugal from {amount}"
        locale="en"
      />,
    );

    const text = "Free shipping in Portugal from €45.00";
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText(text, { selector: ".announcement-bar__static" })).toBeInTheDocument();

    const bar = document.querySelector(".announcement-bar");
    expect(bar).not.toBeNull();
    expect(bar).not.toHaveAttribute("aria-label");
    expect(bar).toHaveAttribute("data-hidden", "false");
    expect(bar?.querySelector(".announcement-bar__marquee")).toHaveAttribute("aria-hidden", "true");
    expect(bar?.querySelectorAll(".announcement-bar__cycle span")).toHaveLength(
      ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF * 2,
    );
  });

  it("marks the bar hidden after scroll past the threshold", () => {
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      },
    );
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (typeof listener === "function") listeners.set(type, listener);
    });
    vi.spyOn(window, "removeEventListener").mockImplementation(() => undefined);

    render(
      <AnnouncementBar
        enabled
        threshold={{ amount: "45.0", currencyCode: "EUR" }}
        template="Free shipping from {amount}"
        locale="en"
      />,
    );

    const bar = document.querySelector(".announcement-bar");
    expect(bar).toHaveAttribute("data-hidden", "false");

    Object.defineProperty(window, "scrollY", { value: 40, configurable: true });
    act(() => {
      listeners.get("scroll")?.(new Event("scroll"));
    });

    expect(bar).toHaveAttribute("data-hidden", "true");
  });
});

