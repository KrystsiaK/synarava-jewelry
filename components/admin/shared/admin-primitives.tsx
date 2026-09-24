"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import {
  buildAdminNavItems,
  type AdminNavPageRef,
} from "@/components/admin/shared/admin-nav-config";
import { AdminNavTree } from "@/components/admin/shared/admin-nav-tree";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export type { AdminNavPageRef };

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
      className="adm-topbar shrink-0 flex items-center justify-between gap-4 border-b px-4 py-3 md:px-5"
      data-scrolled={hasScrolled ? "true" : "false"}
    >
      {children}
    </div>
  );
}

export type AdminTopbarIssueSignal = {
  targetHref: string;
};

function hrefPathname(href: string) {
  return href.split("#")[0]?.split("?")[0] || href;
}

export function AdminTopbarIssueLink({
  issues,
}: {
  issues: AdminTopbarIssueSignal[];
}) {
  const pathname = usePathname();
  const totalCount = issues.length;
  const localIssues = issues.filter((issue) => hrefPathname(issue.targetHref) === pathname);
  const localCount = localIssues.length;

  if (totalCount <= 0) return null;

  const href = localIssues[0]?.targetHref ?? "/admin/issues";
  const ariaLabel =
    localCount > 0
      ? `${localCount} problem${localCount === 1 ? "" : "s"} on this page, ${totalCount} open total`
      : `${totalCount} open admin problems`;

  return (
    <Link href={href} className="adm-topbar-issue-link" aria-label={ariaLabel}>
      <span className="adm-topbar-issue-dot" aria-hidden="true" />
      <span>{localCount > 0 ? localCount : totalCount}</span>
      <span>{localCount > 0 ? "here" : "Problems"}</span>
      {localCount > 0 && totalCount !== localCount ? (
        <span className="adm-topbar-issue-total">/ {totalCount} total</span>
      ) : null}
    </Link>
  );
}


export function AdminNav({
  pages = [],
  issueCount = 0,
  issueNavHrefs = [],
  syncCount = 0,
  syncNavHrefs = [],
  onNavigate,
}: {
  pages?: AdminNavPageRef[];
  issueCount?: number;
  issueNavHrefs?: string[];
  syncCount?: number;
  syncNavHrefs?: string[];
  onNavigate?: () => void;
}) {
  const items = useMemo(
    () => buildAdminNavItems({ pages, issueCount, syncCount }),
    [pages, issueCount, syncCount],
  );

  return (
    <AdminNavTree
      items={items}
      issueNavHrefs={issueNavHrefs}
      syncNavHrefs={syncNavHrefs}
      onNavigate={onNavigate}
    />
  );
}

export function AdminMobileMenu({
  footer,
  pages = [],
  issueCount = 0,
  issueNavHrefs = [],
  syncCount = 0,
  syncNavHrefs = [],
}: {
  footer?: ReactNode;
  pages?: AdminNavPageRef[];
  issueCount?: number;
  issueNavHrefs?: string[];
  syncCount?: number;
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
              className="mb-5 flex items-start justify-between gap-4 border-b pb-4"
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
              issueCount={issueCount}
              issueNavHrefs={issueNavHrefs}
              syncCount={syncCount}
              syncNavHrefs={syncNavHrefs}
              onNavigate={() => setOpen(false)}
            />

            {footer ? (
              <div
                className="mt-auto border-t pt-5"
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
