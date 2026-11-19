import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF,
  ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S,
  AnnouncementMarquee,
  announcementMarqueeCopies,
  announcementMarqueeDurationSec,
} from "../announcement-marquee";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("announcementMarqueeDurationSec", () => {
  it("derives duration from half-cycle width at constant px/s", () => {
    expect(announcementMarqueeDurationSec(600, 30)).toBe(10);
    expect(announcementMarqueeDurationSec(900)).toBe(900 / 2 / ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S);
  });

  it("returns 0 for invalid inputs", () => {
    expect(announcementMarqueeDurationSec(0)).toBe(0);
    expect(announcementMarqueeDurationSec(-10)).toBe(0);
    expect(announcementMarqueeDurationSec(100, 0)).toBe(0);
  });
});

describe("announcementMarqueeCopies", () => {
  it("returns enough copies for a seamless dual-half track", () => {
    const copies = announcementMarqueeCopies("Free shipping");
    expect(copies).toHaveLength(ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF);
    expect(copies.every((copy) => copy === "Free shipping")).toBe(true);
  });
});

describe("AnnouncementMarquee", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not render when message is empty", () => {
    const { container: empty } = render(<AnnouncementMarquee message="" />);
    expect(empty).toBeEmptyDOMElement();

    const { container: whitespace } = render(<AnnouncementMarquee message="   " />);
    expect(whitespace).toBeEmptyDOMElement();
  });

  it("exposes one live instance for screen readers and aria-hides marquee duplicates", () => {
    const text = "Free shipping in Portugal from €45.00";
    render(<AnnouncementMarquee message={text} />);

    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText(text, { selector: ".announcement-marquee__static" })).toBeInTheDocument();

    const root = document.querySelector(".announcement-marquee");
    expect(root).not.toBeNull();
    expect(root).not.toHaveAttribute("aria-label");
    expect(root?.querySelector(".announcement-marquee__marquee")).toHaveAttribute("aria-hidden", "true");
    expect(root?.querySelectorAll(".announcement-marquee__cycle span")).toHaveLength(
      ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF * 2,
    );
  });
});
