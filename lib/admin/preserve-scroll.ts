/** Admin main column — see `.admin-content` in `app/globals.css`. */
export const ADMIN_SCROLL_ROOT_SELECTOR = ".admin-content";

export type AdminScrollSnapshot = {
  top: number;
  left: number;
};

/** Disposer for the latest in-flight preserve-scroll schedule. */
let activeCancel: (() => void) | null = null;

export function getAdminScrollRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(ADMIN_SCROLL_ROOT_SELECTOR);
}

/** Capture scroll of the admin content pane (falls back to the window). */
export function captureAdminScroll(): AdminScrollSnapshot {
  const root = getAdminScrollRoot();
  if (root) return { top: root.scrollTop, left: root.scrollLeft };
  if (typeof window === "undefined") return { top: 0, left: 0 };
  return { top: window.scrollY, left: window.scrollX };
}

export function restoreAdminScroll(snapshot: AdminScrollSnapshot) {
  const root = getAdminScrollRoot();
  if (root) {
    root.scrollTop = snapshot.top;
    root.scrollLeft = snapshot.left;
    return;
  }
  if (typeof window === "undefined") return;
  window.scrollTo(snapshot.left, snapshot.top);
}

/** Cancel pending rAF / timeouts from `refreshPreservingScroll` (tests + successive refreshes). */
export function cancelPreserveScrollTimers() {
  activeCancel?.();
  activeCancel = null;
}

/**
 * Soft-refresh keeps the admin editor mounted in place, but RSC commit can
 * reset `.admin-content` scroll. Capture before `router.refresh()`, restore
 * across a few frames until the tree settles.
 *
 * Use for stay-on-page saves. Skip when navigating (`router.push` / delete → list).
 * Returns a disposer that clears pending rAF/timeouts.
 */
export function refreshPreservingScroll(router: { refresh: () => void }): () => void {
  cancelPreserveScrollTimers();

  if (typeof window === "undefined") {
    router.refresh();
    return () => {};
  }

  const snapshot = captureAdminScroll();
  router.refresh();

  let frames = 0;
  const maxFrames = 16;
  let rafId = 0;
  const timeoutIds: number[] = [];
  let cancelled = false;

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    if (typeof window !== "undefined") {
      if (rafId) window.cancelAnimationFrame(rafId);
      for (const id of timeoutIds) window.clearTimeout(id);
    }
    timeoutIds.length = 0;
    if (activeCancel === cancel) activeCancel = null;
  };

  const tick = () => {
    if (cancelled || typeof window === "undefined") return;
    restoreAdminScroll(snapshot);
    frames += 1;
    if (frames < maxFrames) rafId = window.requestAnimationFrame(tick);
  };
  rafId = window.requestAnimationFrame(tick);

  for (const ms of [0, 50, 120, 250]) {
    timeoutIds.push(
      window.setTimeout(() => {
        if (cancelled || typeof window === "undefined") return;
        restoreAdminScroll(snapshot);
      }, ms),
    );
  }

  activeCancel = cancel;
  return cancel;
}
