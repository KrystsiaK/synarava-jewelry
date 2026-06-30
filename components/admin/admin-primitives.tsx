"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  { href: "/admin/collections", label: "Collections", code: "COL" },
  { href: "/admin/account", label: "Account", code: "ACC" },
] as const;

export function AdminNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={compact ? "flex gap-2 overflow-x-auto" : "flex flex-col gap-1"}>
      {NAV_ITEMS.map((item) => {
        const active =
          "exact" in item && item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "true" : undefined}
            className={compact ? "adm-nav-item group shrink-0" : "adm-nav-item group"}
          >
            <span className="adm-nav-arrow">{active ? "◆" : "·"}</span>
            <span className="flex-1">{item.label}</span>
            <span
              className="text-[0.58rem] font-bold uppercase tracking-[0.08em] opacity-30 transition-opacity group-hover:opacity-60"
            >
              {item.code}
            </span>
          </Link>
        );
      })}

      {!compact ? <div className="adm-nav-item opacity-45 pointer-events-none select-none">
        <span className="adm-nav-arrow">·</span>
        <span className="flex-1">Localization</span>
        <span
          className="text-[0.58rem] font-bold uppercase tracking-[0.08em] opacity-100"
          style={{ color: "var(--adm-success)" }}
        >
          PLANNED
        </span>
      </div> : null}

      {!compact ? <hr className="adm-divider my-2" /> : null}

      {!compact ? <a
        href="/shop"
        target="_blank"
        rel="noopener noreferrer"
        className="adm-nav-item"
      >
        <span className="adm-nav-arrow">{"↗"}</span>
        <span className="flex-1">Storefront</span>
      </a> : null}
    </nav>
  );
}
