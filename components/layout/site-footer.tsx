import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="artifact-footer">
      <div className="relative md:col-span-2">
        <div className="artifact-footer__wordmark" aria-hidden="true">
          SYNARAVA
        </div>
        <p className="label-mono mt-16 max-w-sm text-foreground uppercase md:mt-8">
          © 2025 Synarava Jewelry. The soul of Belarusian couture.
        </p>
      </div>

      <div className="flex flex-col gap-4 text-left">
        <p className="label-caps mb-4 text-foreground">Navigation</p>
        <nav className="flex flex-col gap-4">
          <Link href="/shop" className="label-mono font-bold text-accent">
            Shop
          </Link>
          <Link href="/collections" className="label-mono text-muted transition-colors hover:text-foreground">
            Collections
          </Link>
          <Link href="/about" className="label-mono text-muted transition-colors hover:text-foreground">
            About
          </Link>
          <Link href="/about/manifesto" className="label-mono text-muted transition-colors hover:text-foreground">
            Manifesto
          </Link>
        </nav>
      </div>

      <div className="flex flex-col gap-4 text-left">
        <p className="label-caps mb-4 text-foreground">Service</p>
        <nav className="flex flex-col gap-4">
          <Link href="/about" className="label-mono text-muted transition-colors hover:text-foreground">
            Care Guide
          </Link>
          <Link href="/about" className="label-mono text-muted transition-colors hover:text-foreground">
            Shipping
          </Link>
          <Link href="mailto:studio@synarava.com" className="label-mono text-muted transition-colors hover:text-foreground">
            Contact
          </Link>
        </nav>
      </div>

      {/* Legal links — full-width bottom bar on desktop */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-stroke pt-6 md:col-span-4 md:border-t md:pt-6">
        <Link href="/privacy" className="label-mono text-muted transition-colors hover:text-foreground">
          Privacy Policy
        </Link>
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <Link href="/offer" className="label-mono text-muted transition-colors hover:text-foreground">
          Public Offer Agreement
        </Link>
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <p className="label-mono text-muted/60">
          All purchases are governed by our{" "}
          <Link href="/offer" className="underline underline-offset-4 transition-colors hover:text-foreground">
            offer terms
          </Link>
        </p>
      </div>
    </footer>
  );
}
