"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { BrandMark } from "@/components/ui/brand-mark";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useTranslations } from "@/lib/i18n/context";
import { LiquidGlassSurface } from "@synarava/liquid-glass";

type SiteHeaderProps = {
  initialCartCount: number;
  isLoggedIn?: boolean;
};

export function SiteHeader({ initialCartCount, isLoggedIn = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const { t } = useTranslations();
  const [cartCountOverride, setCartCountOverride] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasScrolledHeader, setHasScrolledHeader] = useState(false);
  const cartCount = cartCountOverride ?? initialCartCount;
  const hasCartItems = cartCount > 0;
  const isHome = pathname === "/";
  const usesImmersiveTheme =
    isHome ||
    pathname === "/shop" ||
    pathname === "/cart" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/collections") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/artifacts");

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
    const desktopQuery = window.matchMedia("(min-width: 920px)");

    function closeMenuOnDesktop(event: MediaQueryListEvent | MediaQueryList) {
      if (event.matches) {
        setIsMenuOpen(false);
      }
    }

    closeMenuOnDesktop(desktopQuery);
    desktopQuery.addEventListener("change", closeMenuOnDesktop);

    return () => {
      desktopQuery.removeEventListener("change", closeMenuOnDesktop);
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    function updateHeader() {
      const currentY = window.scrollY;
      setHasScrolledHeader(currentY > 16);
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
        className="artifact-nav relative"
        data-scrolled={hasScrolledHeader ? "true" : "false"}
        data-menu-open={isMenuOpen ? "true" : "false"}
      >
        <LiquidGlassSurface
          className="absolute inset-0 z-0 h-full w-full"
          variant="clear-glass"
          tone="neutral"
          effect="default"
          refractive
          transparency={0.95}
          shineIntensity={1.8}
          materialStyle={{
            border: "none",
            backgroundColor: "transparent",
            backdropFilter: "url(#lg-refract-strong)",
            WebkitBackdropFilter: "url(#lg-refract-strong)",
            boxShadow: hasScrolledHeader
              ? "0 16px 48px rgba(0, 0, 0, 0.4)"
              : "0 12px 40px rgba(0, 0, 0, 0.3)",
          }}
          aria-hidden="true"
        >
          <div className="hidden" aria-hidden="true" />
        </LiquidGlassSurface>

        <div className="z-10 flex items-center gap-2 md:gap-4">
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="site-nav-icon-button min-[920px]:hidden"
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
                tone={usesImmersiveTheme ? "light" : "auto"}
                className="h-full w-full object-contain object-center p-0.5 md:p-0.75 xl:p-1.5"
              />
            </span>
            <span className="site-nav-wordmark hidden font-serif text-[0.98rem] tracking-[0.2em] text-foreground md:inline md:text-[1.45rem] md:tracking-[0.25em]">
              SYNARAVA
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-5 min-[920px]:flex xl:gap-12 relative z-10">
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
          {!usesImmersiveTheme ? (
            <div className="hidden lg:block">
              <ThemeToggle compact />
            </div>
          ) : null}

          <LanguageSwitcher />

          <Link
            href="/cart"
            aria-label={`${t("nav.cart")}${cartCount > 0 ? `, ${cartCount} items` : ""}`}
            className={`relative inline-flex items-center gap-2 px-3 py-2 transition-all hover:text-accent ${
              /* c8 ignore next 4 */
              isActive("/cart")
                ? "bg-foreground/[0.03] text-foreground font-bold"
                : hasCartItems
                  ? "bg-foreground/[0.02] text-foreground font-semibold"
                  : "text-muted"
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
            href={isLoggedIn ? "/profile" : "/login"}
            className="hidden label-caps px-2 text-muted transition-colors hover:text-accent md:inline"
          >
            {isLoggedIn ? t("nav.account") : t("nav.login")}
          </Link>
        </div>
      </header>

      <div
        className={`site-nav-drawer-backdrop fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-300 min-[920px]:hidden ${
          isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`site-nav-drawer fixed inset-y-0 left-0 z-50 flex w-[min(84vw,22rem)] flex-col border-r border-white/10 bg-[#0b0b0d] px-4 pb-7 pt-20 text-[#f3efe9] shadow-[0_20px_50px_rgba(0,0,0,0.36)] transition-transform duration-300 min-[920px]:hidden ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!isMenuOpen}
      >
        <div className="relative z-10 flex flex-col h-full w-full">
          <nav className="flex flex-col pt-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={`border-b border-white/8 py-4 font-serif text-[1.38rem] leading-none transition-colors hover:text-white ${
                  isActive(item.match) ? "text-[#f3efe9]" : "text-[#bdb7b0]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-7 flex flex-col gap-3">
            <Link href={isLoggedIn ? "/profile" : "/login"} onClick={() => setIsMenuOpen(false)} className="label-caps text-[#bdb7b0] transition-colors hover:text-white">
              {isLoggedIn ? t("nav.account") : t("nav.loginRegister")}
            </Link>
          </div>

          <div className="mt-auto border-t border-white/12 pt-4">
            {!usesImmersiveTheme ? (
              <div className="mb-4 border-b border-white/8 pb-4">
                <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                  Appearance
                </p>
                <ThemeToggle compact />
              </div>
            ) : null}
            <div className="flex min-h-11 items-center justify-end">
              <div className="[&>div>button]:!text-[#d0cac2] [&>div>button:hover]:!text-white">
                <LanguageSwitcher showCode align="left" />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
