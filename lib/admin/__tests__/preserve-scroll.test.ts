import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_SCROLL_ROOT_SELECTOR,
  cancelPreserveScrollTimers,
  captureAdminScroll,
  refreshPreservingScroll,
  restoreAdminScroll,
} from "@/lib/admin/preserve-scroll";

describe("preserve-scroll", () => {
  beforeEach(() => {
    document.body.innerHTML = `<main class="admin-content"></main>`;
    const root = document.querySelector<HTMLElement>(ADMIN_SCROLL_ROOT_SELECTOR)!;
    Object.defineProperty(root, "scrollTop", { value: 0, writable: true, configurable: true });
    Object.defineProperty(root, "scrollLeft", { value: 0, writable: true, configurable: true });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cancelPreserveScrollTimers();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("captures and restores the admin content scroll position", () => {
    const root = document.querySelector<HTMLElement>(ADMIN_SCROLL_ROOT_SELECTOR)!;
    root.scrollTop = 640;
    root.scrollLeft = 12;

    const snapshot = captureAdminScroll();
    expect(snapshot).toEqual({ top: 640, left: 12 });

    root.scrollTop = 0;
    root.scrollLeft = 0;
    restoreAdminScroll(snapshot);
    expect(root.scrollTop).toBe(640);
    expect(root.scrollLeft).toBe(12);
  });

  it("restores scroll after refresh across frames and delayed timeouts", () => {
    vi.useFakeTimers();
    const root = document.querySelector<HTMLElement>(ADMIN_SCROLL_ROOT_SELECTOR)!;
    root.scrollTop = 900;
    const router = { refresh: vi.fn() };

    refreshPreservingScroll(router);

    expect(router.refresh).toHaveBeenCalledTimes(1);
    root.scrollTop = 0;
    vi.runAllTimers();
    expect(root.scrollTop).toBe(900);
  });

  it("clears pending timeouts so restore does not run after cancel", () => {
    vi.useFakeTimers();
    const root = document.querySelector<HTMLElement>(ADMIN_SCROLL_ROOT_SELECTOR)!;
    root.scrollTop = 400;
    const router = { refresh: vi.fn() };

    const cancel = refreshPreservingScroll(router);
    root.scrollTop = 0;
    cancel();
    vi.runAllTimers();
    expect(root.scrollTop).toBe(0);
  });

  it("no-ops capture/restore when window is unavailable", () => {
    document.body.innerHTML = "";
    vi.stubGlobal("window", undefined);
    expect(captureAdminScroll()).toEqual({ top: 0, left: 0 });
    expect(() => restoreAdminScroll({ top: 10, left: 2 })).not.toThrow();
  });

  it("refresh without window still refreshes and returns a no-op cancel", () => {
    vi.stubGlobal("window", undefined);
    const router = { refresh: vi.fn() };
    const cancel = refreshPreservingScroll(router);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(() => cancel()).not.toThrow();
  });
});
