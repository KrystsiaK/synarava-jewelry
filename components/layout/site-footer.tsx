"use client";

import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { useTranslations } from "@/lib/i18n/context";

export function SiteFooter() {
  const { t } = useTranslations();

  return (
    <footer className="artifact-footer">
      <div className="relative md:col-span-2">
        <div className="artifact-footer__wordmark" aria-hidden="true">
          SYNARAVA
        </div>
        <div className="mt-16 flex items-center gap-3 md:mt-8">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden md:h-20 md:w-20">
            <BrandMark
              alt="Synarava"
              size={128}
              className="h-[5.5rem] w-[5.5rem] max-w-none object-contain object-center md:h-[6.5rem] md:w-[6.5rem]"
            />
          </span>
          <p className="label-mono max-w-xs text-foreground uppercase">
            {t("footer.copyright")} {t("footer.tagline")}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 text-left">
        <p className="label-caps mb-4 text-foreground">{t("footer.navigationHeading")}</p>
        <nav className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-4 text-left">
        <p className="label-caps mb-4 text-foreground">{t("footer.serviceHeading")}</p>
        <nav className="flex flex-col gap-4">
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

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-stroke pt-6 md:col-span-4 md:border-t md:pt-6">
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
