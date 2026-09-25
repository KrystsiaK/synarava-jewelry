import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";
import React from "react";

// ── Next.js ─────────────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/"),
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

// ── IntersectionObserver ─────────────────────────────────────────────────────
global.IntersectionObserver = vi.fn().mockImplementation((cb) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  _cb: cb,
})) as unknown as typeof IntersectionObserver;

// ── scrollIntoView / scrollTo ────────────────────────────────────────────────
// jsdom doesn't implement layout, so it has no scrollIntoView at all — any
// validate()-triggered focusFirstInvalidField() call throws without this.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}
window.scrollTo = vi.fn() as typeof window.scrollTo;

// ── ProseMirror / TipTap in jsdom ────────────────────────────────────────────
// Layout APIs TipTap needs when focusing or pasting into the editor surface.
document.elementFromPoint = document.elementFromPoint ?? (() => null);
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () =>
    ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
}
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () =>
    ({
      item: () => null,
      length: 0,
      *[Symbol.iterator]() {},
    }) as unknown as DOMRectList;
}

// ── matchMedia ───────────────────────────────────────────────────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

afterEach(() => {
  vi.clearAllMocks();
});
