import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanHover } from "@/lib/hooks/use-can-hover";

type MediaListener = (event: MediaQueryListEvent) => void;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<MediaListener>();
  const media = {
    matches,
    media: "(hover: hover) and (pointer: fine)",
    onchange: null,
    addEventListener: (_: string, listener: MediaListener) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: MediaListener) => {
      listeners.delete(listener);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    setMatches(next: boolean) {
      media.matches = next;
      const event = { matches: next } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  return media;
}

describe("useCanHover", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports true when hover + fine pointer match", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(true);
  });

  it("reports false on touch / coarse pointer devices", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(false);
  });

  it("updates when the media query changes", () => {
    const media = mockMatchMedia(true);
    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(true);

    act(() => {
      media.setMatches(false);
    });
    expect(result.current).toBe(false);
  });
});
