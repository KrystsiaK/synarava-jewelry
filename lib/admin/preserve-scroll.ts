/** Admin main column — see `.admin-content` in `app/globals.css`. */
export const ADMIN_SCROLL_ROOT_SELECTOR = ".admin-content";

export type AdminScrollSnapshot = {
  top: number;
  left: number;
};

export function getAdminScrollRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(ADMIN_SCROLL_ROOT_SELECTOR);
}

/** Capture scroll of the admin content pane (falls back to the window). */
export function captureAdminScroll(): AdminScrollSnapshot {
  const root = getAdminScrollRoot();
  if (root) return { top: root.scrollTop, left: root.scrollLeft };
  return { top: window.scrollY, left: window.scrollX };
}

export function restoreAdminScroll(snapshot: AdminScrollSnapshot) {
  const root = getAdminScrollRoot();
  if (root) {
    root.scrollTop = snapshot.top;
    root.scrollLeft = snapshot.left;
    return;
  }
  window.scrollTo(snapshot.left, snapshot.top);
}

/**
 * Soft-refresh keeps the admin editor mounted in place, but RSC commit can
 * reset `.admin-content` scroll. Capture before `router.refresh()`, restore
 * across a few frames until the tree settles.
 *
 * Use for stay-on-page saves. Skip when navigating (`router.push` / delete → list).
 */
export function refreshPreservingScroll(router: { refresh: () => void }) {
  const snapshot = captureAdminScroll();
  router.refresh();

  let frames = 0;
  const maxFrames = 16;
  const tick = () => {
    restoreAdminScroll(snapshot);
    frames += 1;
    if (frames < maxFrames) window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);

  // Late RSC commits after paint — short delayed restores, then stop.
  for (const ms of [0, 50, 120, 250]) {
    window.setTimeout(() => restoreAdminScroll(snapshot), ms);
  }
}
