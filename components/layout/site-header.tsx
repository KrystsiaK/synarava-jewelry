"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { BrandMark } from "@/components/ui/brand-mark";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useTranslations } from "@/lib/i18n/context";

type SiteHeaderProps = {
  initialCartCount: number;
};

const HIDE_SCROLL_DELTA = 8;
const REVEAL_SCROLL_DELTA = 4;
const PINNED_TOP_OFFSET = 96;

export function SiteHeader({ initialCartCount }: SiteHeaderProps) {
  const pathname = usePathname();
  const { t } = useTranslations();
  const [cartCountOverride, setCartCountOverride] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [hasScrolledHeader, setHasScrolledHeader] = useState(false);
  const cartCount = cartCountOverride ?? initialCartCount;
  const hasCartItems = cartCount > 0;

  const navItems = [
    { href: "/", label: t("nav.home"), match: "/" },
    { href: "/shop", label: t("nav.shop"), match: "/shop" },
    { href: "/collections", label: t("nav.collections"), match: "/collections" },
    { href: "/about", label: t("nav.about"), match: "/about" },
  ];

  useEffect(() => {
    function handleCartUpdated(event: Event) {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      setCartCountOverride(detail?.count ?? 0);
    }

    window.addEventListener("synarava:cart-updated", handleCartUpdated);
    return () => {
      window.removeEventListener("synarava:cart-updated", handleCartUpdated);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    function updateHeader() {
      const currentY = window.scrollY;
      const delta = currentY - lastY;

      setHasScrolledHeader(currentY > 16);

      if (currentY <= PINNED_TOP_OFFSET) {
        setIsHeaderHidden(false);
      } else if (delta > HIDE_SCROLL_DELTA) {
        setIsHeaderHidden(true);
      } else if (delta < -REVEAL_SCROLL_DELTA) {
        setIsHeaderHidden(false);
      }

      lastY = currentY;
      frame = 0;
    }

    function handleScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(updateHeader);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function isActive(match: string) {
    if (match === "/") {
      return pathname === "/";
    }
    if (match === "/shop") {
      return pathname === "/shop" || pathname.startsWith("/products") || pathname.startsWith("/artifacts");
    }
    if (match === "/collections") {
      return pathname === "/collections" || pathname.startsWith("/collections/");
    }
    if (match === "/cart") {
      return pathname === "/cart" || pathname.startsWith("/checkout");
    }
    return pathname === match || pathname.startsWith(`${match}/`);
  }

  return (
    <>
      <header
        className="artifact-nav"
        data-hidden={isHeaderHidden && !isMenuOpen ? "true" : "false"}
        data-scrolled={hasScrolledHeader ? "true" : "false"}
        data-menu-open={isMenuOpen ? "true" : "false"}
      >
        <div className="z-10 flex items-center gap-2 md:gap-4">
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="site-nav-icon-button xl:hidden"
            aria-label={isMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>

          <Link
            href="/"
            className="site-nav-brand absolute left-1/2 flex -translate-x-1/2 items-center justify-center md:static md:translate-x-0 md:gap-4"
            aria-label="SYNARAVA"
          >
            <span className="site-nav-mark flex shrink-0 items-center justify-center overflow-hidden">
              <BrandMark
                alt=""
                priority
                size={160}
                className="h-full w-full object-contain object-center p-0.5 md:p-0.75 xl:p-1.5"
              />
            </span>
            <span className="site-nav-wordmark hidden font-serif text-[0.98rem] tracking-[0.2em] text-foreground md:inline md:text-[1.45rem] md:tracking-[0.25em]">
              SYNARAVA
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-8 xl:flex xl:gap-12">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`label-caps transition-colors hover:text-accent ${
                isActive(item.match)
                  ? "border-b border-foreground pb-1 text-foreground"
                  : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="relative z-10 flex items-center gap-2 md:gap-3">
          <div className="hidden lg:block">
            <ThemeToggle compact />
          </div>

          <LanguageSwitcher />

          <Link
            href="/cart"
            aria-label={`${t("nav.cart")}${cartCount > 0 ? `, ${cartCount} items` : ""}`}
            className={`relative inline-flex items-center gap-2 border px-3 py-2 transition-all hover:border-foreground/30 hover:text-accent ${
              /* c8 ignore next 4 */
              isActive("/cart")
                ? "border-foreground/20 bg-foreground/[0.03] text-foreground"
                : hasCartItems
                  ? "border-foreground/10 bg-foreground/[0.02] text-foreground"
                  : "border-transparent text-muted"
            }`}
          >
            <span className="relative inline-flex items-center justify-center">
              <ShoppingBag className="size-5" />
              <span className="t-badge" data-open={cartCount > 0 ? "true" : "false"}>
                <span className="t-badge-dot inline-flex min-h-4.5 min-w-4.5 items-center justify-center rounded-full border border-background/10 bg-foreground/88 px-1 text-[9px] font-semibold text-background shadow-[0_4px_10px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                  {cartCount}
                </span>
              </span>
            </span>
            <span
              className={`hidden label-caps sm:inline ${
                isActive("/cart") || hasCartItems ? "text-foreground" : "text-muted"
              }`}
            >
              {t("nav.cart")}
            </span>
          </Link>

          <Link
            href="/login"
            className="hidden label-caps px-2 text-muted transition-colors hover:text-accent md:inline"
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/admin"
            className="hidden label-caps px-2 text-muted transition-colors hover:text-accent lg:inline"
          >
            {t("nav.admin")}
          </Link>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm transition-opacity duration-300 xl:hidden ${
          isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(88vw,24rem)] flex-col border-r border-foreground/10 bg-background px-5 pb-8 pt-24 shadow-[0_20px_50px_rgba(25,21,18,0.12)] transition-transform duration-300 xl:hidden ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!isMenuOpen}
      >
        <div className="mb-8 flex items-center gap-3">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>

        <nav className="flex flex-col border-t border-foreground/10 pt-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMenuOpen(false)}
              className={`border-b border-foreground/8 py-4 font-serif text-[1.55rem] transition-colors ${
                isActive(item.match) ? "text-foreground" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 flex flex-col gap-4">
          <Link href="/login" onClick={() => setIsMenuOpen(false)} className="label-caps text-muted transition-colors hover:text-accent">
            {t("nav.loginRegister")}
          </Link>
          <Link href="/admin" onClick={() => setIsMenuOpen(false)} className="label-caps text-muted transition-colors hover:text-accent">
            {t("nav.admin")}
          </Link>
        </div>
      </aside>
    </>
  );
}
