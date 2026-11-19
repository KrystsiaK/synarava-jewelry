import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF,
  ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S,
  AnnouncementMarquee,
  announcementMarqueeCopies,
  announcementMarqueeDurationSec,
} from "../announcement-marquee";

type ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

class ResizeObserverStub {
  static lastInstance: ResizeObserverStub | null = null;
  private readonly callback: ResizeObserverCallback;
  private targets = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverStub.lastInstance = this;
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
  }

  /** Test helper: fire observer as if the observed node resized. */
  dispatch() {
    const entries = Array.from(this.targets).map((target) => ({
      target,
      contentRect: target.getBoundingClientRect(),
    })) as ResizeObserverEntry[];
    this.callback(entries, this as unknown as ResizeObserver);
  }
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
    ResizeObserverStub.lastInstance = null;
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

  it("recalculates animation duration when cycle width changes (~30 px/s)", () => {
    const text = "Free shipping in Portugal from €45.00";
    render(<AnnouncementMarquee message={text} />);

    const root = document.querySelector(".announcement-marquee") as HTMLElement;
    const cycle = root.querySelector(".announcement-marquee__cycle") as HTMLElement;
    expect(root).not.toBeNull();
    expect(cycle).not.toBeNull();

    const observer = ResizeObserverStub.lastInstance;
    expect(observer).not.toBeNull();

    vi.spyOn(cycle, "getBoundingClientRect").mockReturnValue({
      width: 600,
      height: 40,
      top: 0,
      left: 0,
      bottom: 40,
      right: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    observer!.dispatch();
    expect(root.style.getPropertyValue("--announcement-marquee-duration")).toBe("10s");
    expect(announcementMarqueeDurationSec(600, ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S)).toBe(10);

    vi.spyOn(cycle, "getBoundingClientRect").mockReturnValue({
      width: 1200,
      height: 40,
      top: 0,
      left: 0,
      bottom: 40,
      right: 1200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    observer!.dispatch();
    expect(root.style.getPropertyValue("--announcement-marquee-duration")).toBe("20s");
    expect(announcementMarqueeDurationSec(1200, ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S)).toBe(20);
  });
});
