"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";
import { hasDepartmentTranslation, shopDepartmentTranslationKey } from "@/lib/catalog/taxonomy";

type NavItem = { href: string; label: string; match: string };
type Department = { slug: string; name: string };

type MobileNavDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  drawerRef: RefObject<HTMLElement | null>;
  navItems: NavItem[];
  departments: Department[];
  isActive: (match: string) => boolean;
  isLoggedIn: boolean;
};

export function MobileNavDrawer({
  isOpen,
  onClose,
  drawerRef,
  navItems,
  departments,
  isActive,
  isLoggedIn,
}: MobileNavDrawerProps) {
  const { t, locale } = useTranslations();

  return (
    <>
      <div
        className={`site-nav-drawer-backdrop fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-300 min-[1200px]:hidden ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={drawerRef}
        className={`site-nav-drawer fixed inset-y-0 left-0 z-50 flex w-[min(84vw,22rem)] flex-col border-r border-stroke bg-background px-4 pb-7 pt-20 text-foreground shadow-[0_20px_50px_rgba(0,0,0,0.18)] transition-transform duration-300 min-[1200px]:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!isOpen}
        inert={!isOpen}
        aria-label="Main navigation"
      >
        <div className="relative z-10 flex flex-col h-full w-full">
          <nav className="flex flex-col pt-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={localePath(locale, item.href)}
                onClick={onClose}
                aria-current={isActive(item.match) ? "page" : undefined}
                className={`border-b border-stroke py-4 font-serif text-[1.38rem] leading-none transition-colors hover:text-foreground ${
                  isActive(item.match) ? "text-foreground" : "text-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <nav className="mt-6" aria-label="Shop departments">
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">{t("shop.departments")}</p>
            <div className="grid grid-cols-2 gap-x-4">
              {departments.map((department) => (
                <Link
                  key={department.slug}
                  href={localePath(locale, `/shop?department=${department.slug}`)}
                  onClick={onClose}
                  className="min-h-11 border-b border-stroke py-3 text-sm text-muted transition-colors hover:text-foreground"
                >
                  {hasDepartmentTranslation(department.slug) ? t(`shop.${shopDepartmentTranslationKey(department.slug)}`) : department.name}
                </Link>
              ))}
            </div>
          </nav>

          <div className="mt-7 flex flex-col gap-3">
            <Link href={localePath(locale, isLoggedIn ? "/profile" : "/login")} onClick={onClose} className="label-caps text-muted transition-colors hover:text-foreground">
              {isLoggedIn ? t("nav.account") : t("nav.loginRegister")}
            </Link>
          </div>

          <div className="mt-auto border-t border-stroke pt-4">
            <div className="mb-4 border-b border-stroke pb-4">
              <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">
                {t("theme.appearance")}
              </p>
              <ThemeToggle compact />
            </div>
            <div className="flex min-h-11 items-center justify-end">
              <div className="[&>div>button]:!text-muted [&>div>button:hover]:!text-foreground">
                <LanguageSwitcher showCode align="right" />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
