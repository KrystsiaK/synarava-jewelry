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
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { useDrawerFocusTrap } from "@/components/layout/use-drawer-focus-trap";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";
import { hasDepartmentTranslation, shopDepartmentTranslationKey } from "@/lib/catalog/taxonomy";

type SiteHeaderProps = {
  initialCartCount: number;
  isLoggedIn?: boolean;
  departments?: Array<{ slug: string; name: string }>;
};

export function SiteHeader({ initialCartCount, isLoggedIn = false, departments = [] }: SiteHeaderProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname.replace(/^\/(en|pt)(?=\/|$)/, "") || "/";
  const { resolvedTheme } = useTheme();
  const { t, locale } = useTranslations();
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

  const navItems = [
    { href: "/", label: t("nav.home"), match: "/" },
    { href: "/shop", label: t("nav.shop"), match: "/shop" },
    { href: "/collections", label: t("nav.collections"), match: "/collections" },
    { href: "/journal", label: t("nav.journal"), match: "/journal" },
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

  useDrawerFocusTrap(isMenuOpen, drawerRef, menuButtonRef, () => setIsMenuOpen(false));

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
        data-overlay={pathname === "/shop" ? "true" : undefined}
      >
        <div
          className="site-nav-liquid-glass absolute inset-0 z-0 h-full w-full"
          style={{
            border: "none",
            backgroundColor: "var(--color-header-chrome)",
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
            href={localePath(locale, "/")}
            className="site-nav-brand absolute left-1/2 flex -translate-x-1/2 items-center justify-center md:static md:translate-x-0 md:gap-4"
            aria-label="SYNARAVA"
          >
            <span className="site-nav-mark flex shrink-0 items-center justify-center overflow-hidden min-[1200px]:hidden">
              <BrandMark
                alt=""
                priority
                size={40}
                tone={resolvedTheme === "dark" ? "light" : "dark"}
                className="brand-mark--mobile"
              />
            </span>
            <span className="site-nav-mark site-nav-mark--desktop hidden shrink-0 items-center justify-center min-[1200px]:flex">
              <BrandMark alt="" size={38} tone={resolvedTheme === "dark" ? "light" : "dark"} className="brand-mark--header" />
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
                href={localePath(locale, item.href)}
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
                <Link href={localePath(locale, "/shop")} role="menuitem" onClick={() => setIsShopMenuOpen(false)} className="block min-h-11 px-3 py-3 label-caps hover:bg-foreground/[0.05]">
                  {t("shop.allProducts")}
                </Link>
                {departments.map((department) => (
                  <Link key={department.slug} href={localePath(locale, `/shop?department=${department.slug}`)} role="menuitem" onClick={() => setIsShopMenuOpen(false)} className="block min-h-11 border-t border-stroke px-3 py-3 label-caps text-muted hover:bg-foreground/[0.05] hover:text-foreground">
                    {hasDepartmentTranslation(department.slug) ? t(`shop.${shopDepartmentTranslationKey(department.slug)}`) : department.name}
                  </Link>
                ))}
              </AdaptivePopover>
            </span>
          ) : (
            <Link
              key={item.href}
              href={localePath(locale, item.href)}
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
            href={localePath(locale, "/cart")}
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
            href={localePath(locale, isLoggedIn ? "/profile" : "/login")}
            className="hidden label-caps px-2 text-muted transition-colors hover:text-accent md:inline"
          >
            {isLoggedIn ? t("nav.account") : t("nav.login")}
          </Link>
        </div>
      </header>

      <MobileNavDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        drawerRef={drawerRef}
        navItems={navItems}
        departments={departments}
        isActive={isActive}
        isLoggedIn={isLoggedIn}
      />
    </>
  );
}
