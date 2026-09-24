import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { getServerTranslations } from "@/lib/i18n/server";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { Hanken_Grotesk, Playfair_Display } from "next/font/google";
import { MotionConfig } from "motion/react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import { WebVitalsReporter } from "@/components/telemetry/web-vitals-reporter";
import { PrivacyConsentManager } from "@/components/privacy/privacy-consent-manager";
import { PRIVACY_CONSENT_COOKIE } from "@/lib/privacy/consent";
import { TranslationProvider } from "@/lib/i18n/context";
import { getStorefrontCartCount } from "@/lib/commerce/storefront-cart";
import { getHeaderNav } from "@/lib/content/header-nav";
import { getStorefrontCopy } from "@/lib/content/storefront-copy";
import { getSiteSeo } from "@/lib/content/site-seo";
import { hasShopifyCustomerSession } from "@/lib/shopify/customer-account/session";
import { isThemePreference } from "@/lib/theme/shared";
import { safeJsonLd } from "@/lib/seo/json-ld";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

import "./globals.css";

const sans = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const serif = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const siteUrl = getPublicSiteUrl();
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Synarava",
  url: siteUrl,
  description:
    "Handcrafted couture jewelry rooted in folk symbolism and contemporary design.",
  sameAs: [],
};

const TWITTER_DESCRIPTION_FALLBACK =
  "Selected, useful, and thoughtfully made goods for everyday life and creativity.";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSiteSeo();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      template: seo.titleTemplate,
      default: seo.defaultTitle,
    },
    description: seo.description,
    keywords: [
      "curated goods",
      "handmade gifts",
      "pet accessories",
      "creative products for kids",
      "jewelry making tools",
      "handcrafted jewelry",
      "couture jewelry",
      "lava stone bracelet",
      "folk jewelry",
      "artisan jewelry",
      "symbolic jewelry",
      "collectible jewelry",
      "Slavic jewelry",
    ],
    authors: [{ name: "Synarava" }],
    creator: "Synarava",
    openGraph: {
      type: "website",
      locale: "en_IE",
      siteName: "Synarava",
      title: seo.ogTitle,
      description: seo.ogDescription,
      images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: seo.ogTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.ogTitle,
      description: seo.ogDescription || TWITTER_DESCRIPTION_FALLBACK,
      images: ["/og-default.jpg"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cookieStore, requestHeaders, { locale: initialLocale, t }, publishedLocales] = await Promise.all([
    cookies(),
    headers(),
    getServerTranslations(),
    getPublishedStorefrontLocales(),
  ]);
  // The language switcher only offers locales this app can actually render
  // UI copy for (SUPPORTED_LOCALES, still hardcoded until the buyer-facing
  // copy itself is registry-driven) — intersected with the registry so an
  // unpublished/removed Shopify locale drops out automatically.
  const publishedCodes = new Set(publishedLocales.map((locale) => locale.routeSegment));
  const availableLocales = SUPPORTED_LOCALES.filter((locale) => publishedCodes.has(locale.code));
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const rawPreference = cookieStore.get("synarava-theme")?.value;
  const themePreference = isThemePreference(rawPreference) ? rawPreference : "system";
  const shopifyPrivacyConfig = {
    storefrontAccessToken: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
    checkoutRootDomain: process.env.NEXT_PUBLIC_SHOPIFY_CHECKOUT_ROOT_DOMAIN,
    storefrontRootDomain: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ROOT_DOMAIN,
  };
  const shopifyPrivacyEnabled = Object.values(shopifyPrivacyConfig).every(Boolean);
  const [cartCount, isLoggedIn, storefrontCopy, headerNav] = await Promise.all([
    // An unreachable/slow Shopify Storefront API must not block rendering of the
    // whole app (admin included) for a header badge that isn't essential to any page.
    getStorefrontCartCount().catch(() => null),
    hasShopifyCustomerSession(),
    getStorefrontCopy(),
    getHeaderNav(),
  ]);

  return (
    <html
      lang={initialLocale}
      className={`${sans.variable} ${serif.variable}`}
      data-scroll-behavior="smooth"
      data-theme-preference={themePreference}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <ThemeScript initialPreference={themePreference} nonce={nonce} />
        <script
          id="organization-json-ld"
          nonce={nonce}
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd) }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          {t("a11y.skip")}
        </a>
        <TranslationProvider initialLocale={initialLocale} initialOverrides={storefrontCopy} availableLocales={availableLocales}>
          <PrivacyConsentManager
            initialConsent={cookieStore.get(PRIVACY_CONSENT_COOKIE)?.value}
            shopifyConfig={shopifyPrivacyEnabled ? {
              storefrontAccessToken: shopifyPrivacyConfig.storefrontAccessToken!,
              checkoutRootDomain: shopifyPrivacyConfig.checkoutRootDomain!,
              storefrontRootDomain: shopifyPrivacyConfig.storefrontRootDomain!,
            } : undefined}
            gtmId={process.env.NEXT_PUBLIC_GTM_ID}
            metaPixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID}
            nonce={nonce}
          />
          <WebVitalsReporter />
          <svg
            id="lg-filter-svg"
            style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <defs>
              <filter id="lg-refract" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.008 0.01" numOctaves="1" seed="5" result="noise"/>
                <feGaussianBlur in="noise" stdDeviation="1.5" result="softNoise"/>
                <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="40" xChannelSelector="R" yChannelSelector="G"/>
              </filter>

              <filter id="lg-refract-strong" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.005 0.007" numOctaves="2" seed="9" result="noise"/>
                <feGaussianBlur in="noise" stdDeviation="2.5" result="softNoise"/>
                <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="140" xChannelSelector="R" yChannelSelector="G"/>
              </filter>
            </defs>
          </svg>
          <ThemeProvider initialPreference={themePreference}>
            {/* REV-25: one shared motion policy for every motion.* component in the
                tree, so prefers-reduced-motion is honored even by a component (e.g.
                ProductCard, CartShell, ShopFooter) that never checks useReducedMotion()
                itself — a per-component audit isn't needed for new motion usage either. */}
            <MotionConfig reducedMotion="user">
              <SiteHeader initialCartCount={cartCount} isLoggedIn={isLoggedIn} headerNav={headerNav} />
              <div id="main-content" tabIndex={-1}>{children}</div>
              <SiteFooter />
            </MotionConfig>
          </ThemeProvider>
        </TranslationProvider>
      </body>
    </html>
  );
}
