"use client";

import { useEffect, useRef, useState } from "react";

import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";

/**
 * Blocks leaving the product editor while scoped tabs still have unsaved edits.
 * Uses a confirm modal for in-app links and the browser dialog for tab close/refresh.
 */
export function useUnsavedLeaveGuard(enabled: boolean) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const pendingHrefRef = useRef<string | null>(null);
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const warnBeforeInternalNavigation = (event: MouseEvent) => {
      if (allowLeaveRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (link.target === "_blank") return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      event.preventDefault();
      event.stopPropagation();
      pendingHrefRef.current = url.pathname + url.search + url.hash;
      setLeaveOpen(true);
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeInternalNavigation, true);
    };
  }, [enabled]);

  function confirmLeave() {
    const href = pendingHrefRef.current;
    allowLeaveRef.current = true;
    setLeaveOpen(false);
    pendingHrefRef.current = null;
    if (href) window.location.assign(href);
  }

  function cancelLeave() {
    pendingHrefRef.current = null;
    setLeaveOpen(false);
  }

  const leaveModal = (
    <AdminConfirmModal
      open={leaveOpen}
      title="Unsaved product changes"
      description="Some tabs still have edits that were not saved. If you leave now, those unsaved values will be lost."
      confirmLabel="Leave without saving"
      tone="danger"
      onCancel={cancelLeave}
      onConfirm={confirmLeave}
    />
  );

  return { leaveModal, hasLeavePrompt: leaveOpen };
}
