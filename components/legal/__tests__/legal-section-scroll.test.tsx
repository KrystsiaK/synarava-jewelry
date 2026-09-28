import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LegalSectionScroll, type LegalContentsSection } from "@/components/legal/legal-section-scroll";

type MockObserver = {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  _cb: IntersectionObserverCallback;
};

const sections: LegalContentsSection[] = [
  { id: "data-controller", label: "1. Data controller" },
  { id: "data-we-collect", label: "2. Data we collect" },
  { id: "contact", label: "3. Contact" },
];

function lastObserver(): MockObserver {
  const results = (global.IntersectionObserver as ReturnType<typeof vi.fn>).mock.results;
  return results[results.length - 1].value as MockObserver;
}

function entry(id: string, top: number, isIntersecting: boolean): IntersectionObserverEntry {
  return {
    isIntersecting,
    target: document.getElementById(id)!,
    boundingClientRect: { top } as DOMRectReadOnly,
    rootBounds: { bottom: 113 } as DOMRectReadOnly,
  } as IntersectionObserverEntry;
}

function renderNav(items: readonly LegalContentsSection[] = sections) {
  return render(
    <>
      <LegalSectionScroll contentsLabel="Contents" sections={items} />
      {items.map((section) => (
        <section key={section.id} id={section.id} />
      ))}
    </>,
  );
}

function emit(entries: IntersectionObserverEntry[]) {
  act(() => {
    lastObserver()._cb(entries, lastObserver() as unknown as IntersectionObserver);
  });
}

describe("LegalSectionScroll", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("highlights the section on the reading line and clears above the first heading", () => {
    renderNav();

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#data-controller",
      "#data-we-collect",
      "#contact",
    ]);
    expect(screen.queryByRole("link", { current: true })).toBeNull();

    emit([
      entry("data-controller", -20, false),
      entry("data-we-collect", 112, true),
      entry("contact", 900, false),
    ]);

    const current = screen.getByRole("link", { current: true });
    expect(current).toHaveTextContent("2. Data we collect");
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current.className).toContain("text-foreground!");
    expect(screen.getByRole("link", { name: "1. Data controller" }).className).toContain("text-muted!");
    expect(screen.getByRole("link", { name: "1. Data controller" })).not.toHaveAttribute("aria-current");

    emit([
      entry("data-we-collect", -800, false),
      entry("contact", 80, true),
    ]);
    expect(screen.getByRole("link", { current: true })).toHaveTextContent("3. Contact");

    emit([
      entry("data-controller", 400, false),
      entry("data-we-collect", 900, false),
      entry("contact", 1400, false),
    ]);
    expect(screen.queryByRole("link", { current: true })).toBeNull();
  });

  it("does not listen to scroll and still points each item at its anchor", () => {
    const listen = vi.spyOn(window, "addEventListener");
    renderNav();
    expect(listen.mock.calls.map((call) => call[0])).not.toContain("scroll");
    expect(listen.mock.calls.map((call) => call[0])).toContain("hashchange");
    listen.mockRestore();
  });

  it("keeps a single section and an empty document stable", () => {
    const { unmount } = renderNav([{ id: "only", label: "1. Only" }]);
    emit([entry("only", 20, true)]);
    expect(screen.getByRole("link", { current: true })).toHaveTextContent("1. Only");
    unmount();

    render(<LegalSectionScroll contentsLabel="Contents" sections={[]} />);
    expect(screen.getByText("Contents")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("scrolls a hash jump instantly when reduced motion is requested", async () => {
    const matchMedia = vi.mocked(window.matchMedia);
    matchMedia.mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    window.location.hash = "#data-controller";

    renderNav();
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });

    matchMedia.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
});
