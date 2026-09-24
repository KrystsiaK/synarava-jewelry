import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_SCROLL_ROOT_SELECTOR,
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
  });

  afterEach(() => {
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
});
