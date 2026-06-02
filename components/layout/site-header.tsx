"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme/theme-toggle";

type SiteHeaderProps = {
  initialCartCount: number;
};

const navItems = [
  { href: "/", label: "Home", match: "/" },
  { href: "/shop", label: "Shop", match: "/shop" },
  { href: "/collections", label: "Collections", match: "/collections" },
  { href: "/about", label: "About", match: "/about" },
];

export function SiteHeader({ initialCartCount }: SiteHeaderProps) {
  const pathname = usePathname();
  const [cartCountOverride, setCartCountOverride] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const cartCount = cartCountOverride ?? initialCartCount;
  const hasCartItems = cartCount > 0;

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
      <header className="artifact-nav">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="inline-flex size-11 items-center justify-center border border-foreground/10 text-foreground transition-colors hover:border-foreground/25 hover:bg-foreground/5 md:hidden"
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>

          <Link href="/" className="font-serif text-[1.15rem] tracking-[0.22em] text-foreground md:text-[1.7rem] md:tracking-[0.28em]">
            SYNARAVA
          </Link>
        </div>

        <nav className="hidden items-center gap-8 lg:flex xl:gap-12">
          {navItems.map((item) => (
            <Link
              key={item.label}
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

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden lg:block">
            <ThemeToggle compact />
          </div>

          <Link
            href="/cart"
            aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
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
                <span className="t-badge-dot inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                  {cartCount}
                </span>
              </span>
            </span>
            <span
              className={`hidden label-caps sm:inline ${
                isActive("/cart") || hasCartItems ? "text-foreground" : "text-muted"
              }`}
            >
              Cart
            </span>
          </Link>

          <Link
            href="/login"
            className="hidden label-caps px-2 text-muted transition-colors hover:text-accent md:inline"
          >
            Login
          </Link>
          <Link
            href="/admin"
            className="hidden label-caps px-2 text-muted transition-colors hover:text-accent lg:inline"
          >
            Admin
          </Link>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(88vw,24rem)] flex-col border-r border-foreground/10 bg-background px-5 pb-8 pt-24 shadow-[0_20px_50px_rgba(25,21,18,0.12)] transition-transform duration-300 md:hidden ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!isMenuOpen}
      >
        <div className="mb-8">
          <ThemeToggle />
        </div>

        <nav className="flex flex-col border-t border-foreground/10 pt-6">
          {navItems.map((item) => (
            <Link
              key={item.label}
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
            Login / Register
          </Link>
          <Link href="/admin" onClick={() => setIsMenuOpen(false)} className="label-caps text-muted transition-colors hover:text-accent">
            Admin
          </Link>
        </div>
      </aside>
    </>
  );
}
