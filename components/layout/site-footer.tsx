"use client";

import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import {
  DEFAULT_HEADER_NAV_LABEL_KEYS,
  type HeaderNavData,
} from "@/lib/content/header-nav-fields";
import {
  DEFAULT_FOOTER_LEGAL_LABEL_KEYS,
  DEFAULT_FOOTER_SERVICE_LABEL_KEYS,
  isExternalHref,
  type FooterLinksData,
} from "@/lib/content/footer-links-fields";
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

type FooterLinkView = {
  id: string;
  href: string;
  label: string;
  external: boolean;
};

type SiteFooterProps = {
  /** Same menu as the site header — names + paths (already filtered for live targets). */
  headerNav: HeaderNavData;
  /** Service / legal / social columns (already filtered for live targets). */
  footerLinks: FooterLinksData;
  /** Mailto addresses for the service column. */
  contactEmails: string[];
};

function resolveColumnLinks(
  column: FooterLinksData["service"],
  locale: string,
  t: (key: string) => string,
  defaultLabelKeys: Record<string, string>,
): FooterLinkView[] {
  const localeLabels = column.labels[locale];
  return column.items.map((item) => {
    const override = localeLabels?.[item.id]?.trim();
    const messageKey = defaultLabelKeys[item.id];
    const label =
      override ||
      (messageKey ? t(messageKey) : "") ||
      (isExternalHref(item.href)
        ? (() => {
            try {
              return new URL(item.href).hostname.replace(/^www\./, "");
            } catch {
              return item.href;
            }
          })()
        : item.href.replace(/^\//, "") || item.href);
    return {
      id: item.id,
      href: item.href,
      label,
      external: isExternalHref(item.href),
    };
  });
}

function FooterTextLink({
  item,
  locale,
  className,
}: {
  item: FooterLinkView;
  locale: string;
  className: string;
}) {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {item.label}
      </a>
    );
  }
  return (
    <Link href={localePath(locale, item.href)} className={className}>
      {item.label}
    </Link>
  );
}

export function SiteFooter({ headerNav, footerLinks, contactEmails }: SiteFooterProps) {
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
      return { id: item.id, href: item.href, label, external: false };
    });

  const serviceItems = resolveColumnLinks(
    footerLinks.service,
    locale,
    t,
    DEFAULT_FOOTER_SERVICE_LABEL_KEYS,
  );
  const legalItems = resolveColumnLinks(
    footerLinks.legal,
    locale,
    t,
    DEFAULT_FOOTER_LEGAL_LABEL_KEYS,
  );
  const socialItems = resolveColumnLinks(footerLinks.socials, locale, t, {});
  const showSocials = socialItems.length > 0;
  const emails = contactEmails.filter((email) => email.trim());

  return (
    <footer data-component="SiteFooter" className="artifact-footer">
      <div className={`relative text-center md:text-left ${showSocials ? "" : "md:col-span-2"}`}>
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
            <FooterTextLink
              key={item.id}
              item={item}
              locale={locale}
              className={`label-mono text-[0.9rem] transition-colors hover:text-foreground md:text-inherit ${
                index === 0 ? "font-bold text-accent" : "text-muted"
              }`}
            />
          ))}
        </nav>
      </div>

      <FooterOrnamentDivider />

      <div className="flex flex-col gap-4 text-center md:text-left">
        <p className="label-caps mb-3 text-[0.72rem] text-foreground md:mb-4 md:text-inherit">{t("footer.serviceHeading")}</p>
        <nav className="flex flex-col gap-3 items-center md:items-start md:gap-4">
          {serviceItems.map((item) => (
            <FooterTextLink
              key={item.id}
              item={item}
              locale={locale}
              className="label-mono text-[0.9rem] text-muted transition-colors hover:text-foreground md:text-inherit"
            />
          ))}
          {emails.map((email) => (
            <a
              key={email}
              href={`mailto:${email}`}
              aria-label={`${t("footer.contact")}: ${email}`}
              className="label-mono text-[0.9rem] text-muted transition-colors hover:text-foreground md:text-inherit"
            >
              {email}
            </a>
          ))}
        </nav>
      </div>

      {showSocials ? (
        <>
          <FooterOrnamentDivider />
          <div className="flex flex-col gap-4 text-center md:text-left">
            <p className="label-caps mb-3 text-[0.72rem] text-foreground md:mb-4 md:text-inherit">
              {t("footer.socialHeading")}
            </p>
            <nav className="flex flex-col gap-3 items-center md:items-start md:gap-4">
              {socialItems.map((item) => (
                <FooterTextLink
                  key={item.id}
                  item={item}
                  locale={locale}
                  className="label-mono text-[0.9rem] text-muted transition-colors hover:text-foreground md:text-inherit"
                />
              ))}
            </nav>
          </div>
        </>
      ) : null}

      <FooterOrnamentDivider />

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-stroke pt-6 text-center md:col-span-4 md:justify-start md:border-t md:pt-6 md:text-left">
        {legalItems.map((item, index) => (
          <span key={item.id} className="contents">
            {index > 0 ? (
              <span className="hidden text-stroke md:inline" aria-hidden="true">
                ·
              </span>
            ) : null}
            <FooterTextLink
              item={item}
              locale={locale}
              className={
                item.href === "/cookie-settings"
                  ? "label-mono py-1 text-muted underline decoration-transparent underline-offset-4 transition-colors hover:text-foreground hover:decoration-current"
                  : "label-mono py-1 text-muted transition-colors hover:text-foreground"
              }
            />
          </span>
        ))}
      </div>
    </footer>
  );
}
