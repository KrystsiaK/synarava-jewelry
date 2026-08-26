"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTheme } from "@/components/theme/theme-provider";
import { BrandMark } from "@/components/ui/brand-mark";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { AdaptivePopover } from "@/components/ui/adaptive-popover";
import { useTranslations } from "@/lib/i18n/context";
import { SHOP_DEPARTMENTS } from "@/lib/catalog/taxonomy";

type SiteHeaderProps = {
  initialCartCount: number;
  isLoggedIn?: boolean;
};

export function SiteHeader({ initialCartCount, isLoggedIn = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslations();
  const reduceMotion = useReducedMotion() ?? false;
  const [cartCountOverride, setCartCountOverride] = useState<{
    count: number;
    sourceCount: number;
  } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false);
  const [hasScrolledHeader, setHasScrolledHeader] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const cartCount =
    cartCountOverride?.sourceCount === initialCartCount
      ? cartCountOverride.count
      : initialCartCount;
  const hasCartItems = cartCount > 0;
  const hasDarkHero =
    pathname === "/" ||
    pathname === "/shop" ||
    pathname === "/cart" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/collections") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/artifacts") ||
    pathname.startsWith("/about");
  const isOverDarkHero =
    hasDarkHero &&
    !hasScrolledHeader &&
    !isMenuOpen &&
    resolvedTheme === "dark";

  const navItems = [
    { href: "/", label: t("nav.home"), match: "/" },
    { href: "/shop", label: t("nav.shop"), match: "/shop" },
    { href: "/collections", label: t("nav.collections"), match: "/collections" },
    { href: "/about", label: t("nav.about"), match: "/about" },
  ];

  useEffect(() => {
    function handleCartUpdated(event: Event) {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      setCartCountOverride({
        count: detail?.count ?? 0,
        sourceCount: initialCartCount,
      });
    }

    window.addEventListener("synarava:cart-updated", handleCartUpdated);
    return () => {
      window.removeEventListener("synarava:cart-updated", handleCartUpdated);
    };
  }, [initialCartCount]);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const drawer = drawerRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const menuButton = menuButtonRef.current;
    const background = Array.from(document.querySelectorAll<HTMLElement>("main, footer"));
    background.forEach((element) => { element.inert = true; });
    drawer?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      background.forEach((element) => { element.inert = false; });
      document.removeEventListener("keydown", handleKeyDown);
      (previousFocus?.isConnected ? previousFocus : menuButton)?.focus();
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1200px)");

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
        data-over-dark={isOverDarkHero ? "true" : "false"}
      >
        <div
          className="site-nav-liquid-glass absolute inset-0 z-0 h-full w-full"
          style={{
            border: "none",
            backgroundColor: "transparent",
            backdropFilter: "url(#lg-refract-strong)",
            WebkitBackdropFilter: "url(#lg-refract-strong)",
            boxShadow: "var(--site-nav-shadow)",
          }}
          aria-hidden="true"
        />
        <div className="site-nav-mobile-glass absolute inset-0 z-0" aria-hidden="true" />

        <div className="z-10 flex items-center gap-2 md:gap-4">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="site-nav-icon-button min-[1200px]:hidden"
            aria-label={isMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="size-4.5" aria-hidden="true" /> : <Menu className="size-4.5" aria-hidden="true" />}
          </button>

          <Link
            href="/"
            className="site-nav-brand absolute left-1/2 flex -translate-x-1/2 items-center justify-center md:static md:translate-x-0 md:gap-4"
            aria-label="SYNARAVA"
          >
            <span className="site-nav-mark flex shrink-0 items-center justify-center overflow-hidden min-[1200px]:hidden">
              <BrandMark
                alt=""
                priority
                size={40}
                tone={isOverDarkHero || resolvedTheme === "dark" ? "light" : "dark"}
                className="brand-mark--mobile"
              />
            </span>
            <span className="site-nav-mark site-nav-mark--desktop hidden shrink-0 items-center justify-center min-[1200px]:flex">
              <BrandMark alt="" size={38} tone={isOverDarkHero || resolvedTheme === "dark" ? "light" : "dark"} className="brand-mark--header" />
            </span>
            <span className="site-nav-wordmark-text hidden min-[1200px]:grid" aria-hidden="true">
              <span>SYNARAVA</span>
              <span>CURATED GOODS</span>
            </span>
          </Link>
        </div>

        <nav className="relative z-10 hidden items-center gap-5 min-[1200px]:flex xl:gap-12">
          {navItems.map((item) => item.match === "/shop" ? (
            <span key={item.href} className="flex items-center gap-1">
              <Link
                href={item.href}
                aria-current={isActive(item.match) ? "page" : undefined}
                className={`label-caps transition-colors hover:text-accent ${isActive(item.match) ? "border-b border-foreground pb-1 text-foreground" : "text-muted"}`}
              >
                {item.label}
              </Link>
              <AdaptivePopover
                open={isShopMenuOpen}
                onOpenChange={setIsShopMenuOpen}
                role="menu"
                ariaLabel="Shop departments"
                minWidth={240}
                renderTrigger={(props) => (
                  <button
                    {...props}
                    type="button"
                    aria-haspopup="menu"
                    aria-label="Open shop departments"
                    className="inline-flex size-11 items-center justify-center text-muted transition-colors hover:text-accent"
                  >
                    <ChevronDown className={`size-3.5 transition-transform motion-reduce:transition-none ${isShopMenuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                )}
                className="border border-stroke bg-panel p-2 text-foreground shadow-[0_18px_45px_rgba(0,0,0,0.16)]"
              >
                <Link href="/shop" role="menuitem" onClick={() => setIsShopMenuOpen(false)} className="block min-h-11 px-3 py-3 label-caps hover:bg-foreground/[0.05]">
                  {t("shop.allProducts")}
                </Link>
                {SHOP_DEPARTMENTS.map((department) => (
                  <Link key={department.slug} href={`/shop?department=${department.slug}`} role="menuitem" onClick={() => setIsShopMenuOpen(false)} className="block min-h-11 border-t border-stroke px-3 py-3 label-caps text-muted hover:bg-foreground/[0.05] hover:text-foreground">
                    {t(`shop.${department.slug === "jewelry-making" ? "jewelryMaking" : department.slug}`)}
                  </Link>
                ))}
              </AdaptivePopover>
            </span>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.match) ? "page" : undefined}
              className={`label-caps transition-colors hover:text-accent ${isActive(item.match) ? "border-b border-foreground pb-1 text-foreground" : "text-muted"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="relative z-10 flex items-center gap-2 md:gap-3">
          <div className="hidden min-[1200px]:block">
            <ThemeToggle compact />
          </div>

          <LanguageSwitcher />

          <Link
            href="/cart"
            aria-label={`${t("nav.cart")}${cartCount > 0 ? `, ${cartCount} items` : ""}`}
            className={`relative inline-flex min-h-11 items-center gap-2 px-3 py-2 transition-[background-color,color,transform] hover:text-accent ${
              /* c8 ignore next 4 */
              isActive("/cart")
                ? "bg-foreground/[0.03] text-foreground font-bold"
                : hasCartItems
                  ? "bg-foreground/[0.02] text-foreground font-semibold"
                  : "text-muted"
            }`}
          >
            <span className="relative inline-flex items-center justify-center">
              <ShoppingBag className="size-5" aria-hidden="true" />
              <span className="t-badge" aria-hidden="true">
                <AnimatePresence initial={false} mode="popLayout">
                  {hasCartItems ? (
                    <motion.span
                      key={cartCount}
                      className="t-badge-dot"
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.42, y: 3, filter: "blur(2px)" }}
                      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.52, y: -3, filter: "blur(1px)" }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : {
                              type: "spring",
                              stiffness: 520,
                              damping: 21,
                              mass: 0.52,
                            }
                      }
                    >
                      {cartCount}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
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
        className={`site-nav-drawer-backdrop fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-300 min-[1200px]:hidden ${
          isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        ref={drawerRef}
        className={`site-nav-drawer fixed inset-y-0 left-0 z-50 flex w-[min(84vw,22rem)] flex-col border-r border-stroke bg-background px-4 pb-7 pt-20 text-foreground shadow-[0_20px_50px_rgba(0,0,0,0.18)] transition-transform duration-300 min-[1200px]:hidden ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!isMenuOpen}
        inert={!isMenuOpen}
        aria-label="Main navigation"
      >
        <div className="relative z-10 flex flex-col h-full w-full">
          <nav className="flex flex-col pt-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
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
              {SHOP_DEPARTMENTS.map((department) => (
                <Link
                  key={department.slug}
                  href={`/shop?department=${department.slug}`}
                  onClick={() => setIsMenuOpen(false)}
                  className="min-h-11 border-b border-stroke py-3 text-sm text-muted transition-colors hover:text-foreground"
                >
                  {t(`shop.${department.slug === "jewelry-making" ? "jewelryMaking" : department.slug}`)}
                </Link>
              ))}
            </div>
          </nav>

          <div className="mt-7 flex flex-col gap-3">
            <Link href={isLoggedIn ? "/profile" : "/login"} onClick={() => setIsMenuOpen(false)} className="label-caps text-muted transition-colors hover:text-foreground">
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
