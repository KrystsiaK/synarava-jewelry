"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export function AdminThemeShell() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevTheme = html.getAttribute("data-theme");
    html.setAttribute("data-theme", "dark");
    body.classList.add("admin-mode");
    return () => {
      if (prevTheme) html.setAttribute("data-theme", prevTheme);
      else html.removeAttribute("data-theme");
      body.classList.remove("admin-mode");
    };
  }, []);
  return null;
}

const HIDE_SCROLL_DELTA = 8;
const REVEAL_SCROLL_DELTA = 4;
const PINNED_TOP_OFFSET = 96;

export function AdminSmartTopbar({ children }: { children: ReactNode }) {
  const [isHidden, setIsHidden] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    function updateTopbar() {
      const currentY = window.scrollY;
      const delta = currentY - lastY;

      setHasScrolled(currentY > 16);

      if (currentY <= PINNED_TOP_OFFSET) {
        setIsHidden(false);
      } else if (delta > HIDE_SCROLL_DELTA) {
        setIsHidden(true);
      } else if (delta < -REVEAL_SCROLL_DELTA) {
        setIsHidden(false);
      }

      lastY = currentY;
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
    <div
      className="adm-topbar shrink-0 flex items-center justify-between gap-4 border-b px-4 py-3 md:px-5"
      data-hidden={isHidden ? "true" : "false"}
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

const LOCALES = [
  { code: "EN", label: "English" },
  { code: "BE", label: "Беларуская" },
  { code: "RU", label: "Русский" },
] as const;

export function LocaleTabStrip() {
  const [active, setActive] = useState<string>("EN");

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.05] pb-4">
      <span className="adm-section-tag mr-1">LOCALE /</span>
      {LOCALES.map((locale) => (
        <button
          key={locale.code}
          type="button"
          onClick={() => setActive(locale.code)}
          data-active={active === locale.code ? "true" : undefined}
          className="adm-locale-tab"
          title={locale.label}
        >
          {locale.code}
        </button>
      ))}
      <span className="adm-section-tag ml-2">
        {active === "EN" ? "// EN — ACTIVE" : "// TRANSLATION UI — COMING SOON"}
      </span>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/admin", exact: true, label: "Overview", code: "CTRL" },
  { href: "/admin/pages", label: "Pages", code: "PGS" },
  { href: "/admin/products", label: "Catalog", code: "CAT" },
  { href: "/admin/issues", label: "Problems", code: "QA" },
  { href: "/admin/categories", label: "Categories", code: "TAX" },
  { href: "/admin/tags", label: "Tags", code: "TAG" },
  { href: "/admin/collections", label: "Collections", code: "COL" },
  { href: "/admin/account", label: "Account", code: "ACC" },
] as const;

function AdminIssueNavBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="adm-nav-issue-badge" aria-label={`${count} open problems`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AdminNav({
  issueCount = 0,
  issueNavHrefs = [],
  onNavigate,
}: {
  issueCount?: number;
  issueNavHrefs?: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const issueHrefSet = new Set(issueNavHrefs);

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active =
          "exact" in item && item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
        const hasIssue = issueHrefSet.has(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "true" : undefined}
            className="adm-nav-item group"
            onClick={onNavigate}
          >
            <span
              className="adm-nav-arrow"
              data-issue={hasIssue ? "true" : undefined}
              aria-hidden="true"
            >
              {hasIssue ? "" : active ? "◆" : "·"}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.href === "/admin/issues" ? (
              <AdminIssueNavBadge count={issueCount} />
            ) : (
              <span
                className="text-[0.58rem] font-bold uppercase tracking-[0.08em] opacity-30 transition-opacity group-hover:opacity-60"
              >
                {item.code}
              </span>
            )}
          </Link>
        );
      })}

      <div className="adm-nav-item opacity-45 pointer-events-none select-none">
        <span className="adm-nav-arrow">·</span>
        <span className="flex-1">Localization</span>
        <span
          className="text-[0.58rem] font-bold uppercase tracking-[0.08em] opacity-100"
          style={{ color: "var(--adm-success)" }}
        >
          PLANNED
        </span>
      </div>

      <hr className="adm-divider my-2" />

      <a
        href="/shop"
        target="_blank"
        rel="noopener noreferrer"
        className="adm-nav-item"
        onClick={onNavigate}
      >
        <span className="adm-nav-arrow">{"↗"}</span>
        <span className="flex-1">Storefront</span>
      </a>
    </nav>
  );
}

export function AdminMobileMenu({
  footer,
  issueCount = 0,
  issueNavHrefs = [],
}: {
  footer?: ReactNode;
  issueCount?: number;
  issueNavHrefs?: string[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="adm-menu-btn md:hidden"
        aria-label={open ? "Close admin menu" : "Open admin menu"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={18} strokeWidth={1.8} /> : <Menu size={18} strokeWidth={1.8} />}
      </button>

      {open ? (
        <div className="adm-menu-overlay md:hidden" role="presentation" onMouseDown={() => setOpen(false)}>
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
              issueCount={issueCount}
              issueNavHrefs={issueNavHrefs}
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
        </div>
      ) : null}
    </>
  );
}
