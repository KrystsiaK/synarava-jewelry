"use client";

import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { useTranslations } from "@/lib/i18n/context";

function FooterOrnamentDivider() {
  return (
    <div className="flex items-center justify-center gap-5 md:hidden" aria-hidden="true">
      <div className="h-px w-14 bg-stone-beige" />
      <div className="h-2 w-2 rotate-45 border border-couture-red" />
      <div className="h-px w-14 bg-stone-beige" />
    </div>
  );
}

export function SiteFooter() {
  const { t } = useTranslations();

  return (
    <footer className="artifact-footer">
      <div className="relative text-center md:col-span-2 md:text-left">
        <div className="artifact-footer__wordmark" aria-hidden="true">
          SYNARAVA
        </div>
        <div className="mt-16 flex flex-col items-center gap-4 md:mt-8 md:flex-row md:items-center md:gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden md:h-20 md:w-20">
            <BrandMark
              alt="Synarava"
              size={160}
              className="h-full w-full object-contain object-center p-1 md:p-1.5"
            />
          </span>
          <p className="label-mono max-w-xs text-foreground uppercase md:max-w-sm">
            {t("footer.copyright")} {t("footer.tagline")}
          </p>
        </div>
      </div>

      <FooterOrnamentDivider />

      <div className="flex flex-col gap-4 text-center md:text-left">
        <p className="label-caps mb-4 text-foreground">{t("footer.navigationHeading")}</p>
        <nav className="flex flex-col gap-4 items-center md:items-start">
          <Link href="/shop" className="label-mono font-bold text-accent">
            {t("footer.shop")}
          </Link>
          <Link href="/collections" className="label-mono text-muted transition-colors hover:text-foreground">
            {t("footer.collections")}
          </Link>
          <Link href="/about" className="label-mono text-muted transition-colors hover:text-foreground">
            {t("footer.about")}
          </Link>
          <Link href="/about/manifesto" className="label-mono text-muted transition-colors hover:text-foreground">
            {t("footer.manifesto")}
          </Link>
        </nav>
      </div>

      <FooterOrnamentDivider />

      <div className="flex flex-col gap-4 text-center md:text-left">
        <p className="label-caps mb-4 text-foreground">{t("footer.serviceHeading")}</p>
        <nav className="flex flex-col gap-4 items-center md:items-start">
          <Link href="/about" className="label-mono text-muted transition-colors hover:text-foreground">
            {t("footer.careGuide")}
          </Link>
          <Link href="/about" className="label-mono text-muted transition-colors hover:text-foreground">
            {t("footer.shipping")}
          </Link>
          <Link href="mailto:studio@synarava.com" className="label-mono text-muted transition-colors hover:text-foreground">
            {t("footer.contact")}
          </Link>
        </nav>
      </div>

      <FooterOrnamentDivider />

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-stroke pt-6 text-center md:col-span-4 md:justify-start md:border-t md:pt-6 md:text-left">
        <Link href="/privacy" className="label-mono text-muted transition-colors hover:text-foreground">
          {t("footer.privacyPolicy")}
        </Link>
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <Link href="/offer" className="label-mono text-muted transition-colors hover:text-foreground">
          {t("footer.publicOffer")}
        </Link>
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <p className="label-mono text-muted/60">
          {t("footer.offerGovernedBy")}{" "}
          <Link href="/offer" className="underline underline-offset-4 transition-colors hover:text-foreground">
            {t("footer.offerTerms")}
          </Link>
        </p>
      </div>
    </footer>
  );
}
