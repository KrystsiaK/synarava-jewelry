"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import {
  buildAdminNavItems,
  type AdminNavPageRef,
  type AdminNavSyncCounts,
} from "@/components/admin/shared/admin-nav-config";
import { AdminNavTree } from "@/components/admin/shared/admin-nav-tree";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export type { AdminNavPageRef, AdminNavSyncCounts };

export function AdminThemeShell() {
  useEffect(() => {
    const body = document.body;
    body.classList.add("admin-mode");
    return () => {
      body.classList.remove("admin-mode");
    };
  }, []);
  return null;
}

export function AdminThemeToggle() {
  return (
    <div data-component="AdminThemeToggle" className="admin-theme-toggle">
      <ThemeToggle compact />
    </div>
  );
}

export function AdminSmartTopbar({ children }: { children: ReactNode }) {
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;

    function updateTopbar() {
      setHasScrolled(window.scrollY > 16);
      frame = 0;
    }

    function handleScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(updateTopbar);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div data-component="AdminSmartTopbar"
      className="adm-topbar adm-band shrink-0 flex items-center justify-between gap-4 border-b"
      data-scrolled={hasScrolled ? "true" : "false"}
    >
      {children}
    </div>
  );
}

export function AdminNav({
  pages = [],
  syncCount = 0,
  syncCounts,
  syncNavHrefs = [],
  onNavigate,
}: {
  pages?: AdminNavPageRef[];
  /** @deprecated Prefer `syncCounts` — total only, no per-section badges. */
  syncCount?: number;
  syncCounts?: Partial<AdminNavSyncCounts>;
  syncNavHrefs?: string[];
  onNavigate?: () => void;
}) {
  const items = useMemo(
    () => buildAdminNavItems({ pages, syncCount, syncCounts }),
    [pages, syncCount, syncCounts],
  );

  return (
    <AdminNavTree
      items={items}
      syncNavHrefs={syncNavHrefs}
      onNavigate={onNavigate}
    />
  );
}

export function AdminMobileMenu({
  footer,
  pages = [],
  syncCount = 0,
  syncCounts,
  syncNavHrefs = [],
}: {
  footer?: ReactNode;
  pages?: AdminNavPageRef[];
  /** @deprecated Prefer `syncCounts`. */
  syncCount?: number;
  syncCounts?: Partial<AdminNavSyncCounts>;
  syncNavHrefs?: string[];
}) {
  const [open, setOpen] = useState(false);
  const portalTarget = typeof document === "undefined"
    ? null
    : document.querySelector<HTMLElement>(".admin-terminal") ?? document.body;

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const root = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) {
        setOpen(false);
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <button
        type="button"
        className="adm-menu-btn adm-mobile-menu-trigger hidden"
        aria-label={open ? "Close admin menu" : "Open admin menu"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={18} strokeWidth={1.8} /> : <Menu size={18} strokeWidth={1.8} />}
      </button>

      {open && portalTarget ? createPortal(
        <div className="adm-menu-overlay xl:hidden" role="presentation" onMouseDown={() => setOpen(false)}>
          <aside
            className="adm-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div
              className="adm-band mb-5 items-start justify-between gap-4 border-b"
              style={{ borderColor: "var(--adm-border)" }}
            >
              <div>
                <p className="adm-section-tag">Workspace</p>
                <p className="adm-title-sm mt-1.5">Synarava</p>
              </div>
              <button
                type="button"
                className="adm-menu-btn"
                aria-label="Close admin menu"
                onClick={() => setOpen(false)}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            <AdminNav
              pages={pages}
              syncCount={syncCount}
              syncCounts={syncCounts}
              syncNavHrefs={syncNavHrefs}
              onNavigate={() => setOpen(false)}
            />

            {footer ? (
              <div
                className="adm-band mt-auto border-t"
                style={{ borderColor: "var(--adm-border)" }}
              >
                {footer}
              </div>
            ) : null}
          </aside>
        </div>,
        portalTarget,
      ) : null}
    </>
  );
}
