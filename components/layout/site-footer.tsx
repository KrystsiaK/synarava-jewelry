"use client";

import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { PrivacySettingsButton } from "@/components/privacy/privacy-settings-button";
import {
  DEFAULT_HEADER_NAV_LABEL_KEYS,
  type HeaderNavData,
} from "@/lib/content/header-nav-fields";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";

function FooterOrnamentDivider() {
  return (
    <div data-component="FooterOrnamentDivider" className="flex items-center justify-center gap-5 md:hidden" aria-hidden="true">
      <div className="h-px w-14 bg-stone-beige" />
      <div className="h-2 w-2 rotate-45 border border-couture-red" />
      <div className="h-px w-14 bg-stone-beige" />
    </div>
  );
}

type SiteFooterProps = {
  /** Same menu as the site header — names + paths. */
  headerNav: HeaderNavData;
  /** Shared mailto address for the service column. */
  contactEmail: string;
};

export function SiteFooter({ headerNav, contactEmail }: SiteFooterProps) {
  const { t, locale } = useTranslations();
  const localeLabels = headerNav.labels[locale];

  // Mirror header main links; skip bare home so the column stays secondary-nav style.
  const navItems = headerNav.items
    .filter((item) => item.href !== "/")
    .map((item) => {
      const override = localeLabels?.[item.id]?.trim();
      const messageKey = DEFAULT_HEADER_NAV_LABEL_KEYS[item.id];
      const label =
        override ||
        (messageKey ? t(messageKey) : "") ||
        item.href.replace(/^\//, "") ||
        item.href;
      return { href: item.href, label };
    });

  return (
    <footer data-component="SiteFooter" className="artifact-footer">
      <div className="relative text-center md:col-span-2 md:text-left">
        <div className="artifact-footer__wordmark" aria-hidden="true">
          <span>SYNARAVA</span>
          <span>CURATED GOODS</span>
        </div>
        <div className="mt-16 flex flex-col items-center gap-4 md:mt-8 md:flex-row md:items-center md:gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden md:h-20 md:w-20">
            <BrandMark
              alt="Synarava"
              size={64}
              className="artifact-footer__mark p-1 md:p-1.5"
            />
          </span>
          <p className="label-mono max-w-[15rem] text-[0.8rem] leading-[1.35] text-foreground uppercase md:max-w-sm md:text-inherit md:leading-inherit">
            {t("footer.copyright")} {t("footer.tagline")}
          </p>
        </div>
      </div>

      <FooterOrnamentDivider />

      <div className="flex flex-col gap-4 text-center md:text-left">
        <p className="label-caps mb-3 text-[0.72rem] text-foreground md:mb-4 md:text-inherit">{t("footer.navigationHeading")}</p>
        <nav className="flex flex-col gap-3 items-center md:items-start md:gap-4">
          {navItems.map((item, index) => (
            <Link
              key={`${item.href}:${item.label}`}
              href={localePath(locale, item.href)}
              className={`label-mono text-[0.9rem] transition-colors hover:text-foreground md:text-inherit ${
                index === 0 ? "font-bold text-accent" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <FooterOrnamentDivider />

      <div className="flex flex-col gap-4 text-center md:text-left">
        <p className="label-caps mb-3 text-[0.72rem] text-foreground md:mb-4 md:text-inherit">{t("footer.serviceHeading")}</p>
        <nav className="flex flex-col gap-3 items-center md:items-start md:gap-4">
          <Link href={localePath(locale, "/care")} className="label-mono text-[0.9rem] text-muted transition-colors hover:text-foreground md:text-inherit">
            {t("footer.careGuide")}
          </Link>
          <Link href={localePath(locale, "/shipping")} className="label-mono text-[0.9rem] text-muted transition-colors hover:text-foreground md:text-inherit">
            {t("footer.shipping")}
          </Link>
          <Link href={localePath(locale, "/returns")} className="label-mono text-[0.9rem] text-muted transition-colors hover:text-foreground md:text-inherit">
            {t("footer.returns")}
          </Link>
          <Link href={localePath(locale, "/faq")} className="label-mono text-[0.9rem] text-muted transition-colors hover:text-foreground md:text-inherit">
            {t("footer.faq")}
          </Link>
          <Link
            href={`mailto:${contactEmail}`}
            aria-label={`${t("footer.contact")}: ${contactEmail}`}
            className="label-mono text-[0.9rem] text-muted transition-colors hover:text-foreground md:text-inherit"
          >
            {contactEmail}
          </Link>
        </nav>
      </div>

      <FooterOrnamentDivider />

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-stroke pt-6 text-center md:col-span-4 md:justify-start md:border-t md:pt-6 md:text-left">
        <Link href={localePath(locale, "/terms-and-conditions")} className="label-mono py-1 text-muted transition-colors hover:text-foreground">
          {t("footer.termsConditions")}
        </Link>
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <Link href={localePath(locale, "/privacy")} className="label-mono py-1 text-muted transition-colors hover:text-foreground">
          {t("footer.privacyPolicy")}
        </Link>
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <PrivacySettingsButton />
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <Link href={localePath(locale, "/shipping")} className="label-mono py-1 text-muted transition-colors hover:text-foreground">
          {t("footer.shippingPolicy")}
        </Link>
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <Link href={localePath(locale, "/returns")} className="label-mono py-1 text-muted transition-colors hover:text-foreground">
          {t("footer.returnPolicy")}
        </Link>
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <Link href={localePath(locale, "/legal-notice")} className="label-mono py-1 text-muted transition-colors hover:text-foreground">
          {t("footer.legalNotice")}
        </Link>
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <a
          href="https://www.livroreclamacoes.pt/"
          target="_blank"
          rel="noopener noreferrer"
          className="label-mono py-1 text-muted transition-colors hover:text-foreground"
        >
          {t("footer.livroReclamacoes")}
        </a>
        <span className="hidden text-stroke md:inline" aria-hidden="true">·</span>
        <Link href={localePath(locale, "/dispute-resolution")} className="label-mono py-1 text-muted transition-colors hover:text-foreground">
          {t("footer.disputeResolution")}
        </Link>
      </div>
    </footer>
  );
}
