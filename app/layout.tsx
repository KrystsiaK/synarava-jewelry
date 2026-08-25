import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { normalizeLocale } from "@/lib/i18n/locales";
import { Hanken_Grotesk, Playfair_Display } from "next/font/google";
import Script from "next/script";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import { TranslationProvider } from "@/lib/i18n/context";
import { getStorefrontCartCount } from "@/lib/commerce/storefront-cart";
import { getCurrentUser } from "@/lib/auth/session";
import { isShopifyCommerceEnabled } from "@/lib/shopify/config";
import { hasShopifyCustomerSession } from "@/lib/shopify/customer-account/session";
import { isThemePreference } from "@/lib/theme/shared";

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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: "%s | Synarava",
    default: "Synarava — Handcrafted Belarusian Couture Jewelry",
  },
  description:
    "Synarava crafts collectible jewelry rooted in Belarusian folk symbolism and contemporary couture. Handmade from lava stone, oak wood, and white ceramic.",
  keywords: [
    "handcrafted jewelry",
    "Belarusian jewelry",
    "couture jewelry",
    "lava stone bracelet",
    "folk jewelry",
    "artisan jewelry",
    "symbolic jewelry",
    "collectible jewelry",
    "Slavic jewelry",
  ],
  authors: [{ name: "Synarava Studio" }],
  creator: "Synarava",
  openGraph: {
    type: "website",
    locale: "en_IE",
    siteName: "Synarava",
    title: "Synarava — Handcrafted Belarusian Couture Jewelry",
    description:
      "Collectible jewelry rooted in Belarusian folk symbolism and contemporary couture. Handmade from lava stone, oak wood, and white ceramic.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Synarava — Handcrafted Belarusian Couture Jewelry",
    description:
      "Collectible jewelry rooted in Belarusian folk symbolism and contemporary couture.",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const rawPreference = cookieStore.get("synarava-theme")?.value;
  const themePreference = isThemePreference(rawPreference) ? rawPreference : "system";
  const initialLocale = normalizeLocale(cookieStore.get("synarava-locale")?.value);
  const [cartCount, isLoggedIn] = await Promise.all([
    getStorefrontCartCount(),
    isShopifyCommerceEnabled()
      ? hasShopifyCustomerSession()
      : getCurrentUser().then(Boolean),
  ]);

  return (
    <html
      lang={initialLocale}
      className={`${sans.variable} ${serif.variable}`}
      data-theme-preference={themePreference}
      data-theme="light"
      suppressHydrationWarning
    >
      <body>
        <Script
          id="organization-json-ld"
          nonce={nonce}
          suppressHydrationWarning
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Synarava",
              url: siteUrl,
              description:
                "Handcrafted Belarusian couture jewelry rooted in folk symbolism and contemporary design.",
              sameAs: [],
            }),
          }}
        />
        <ThemeScript initialPreference={themePreference} nonce={nonce} />
        <TranslationProvider initialLocale={initialLocale}>
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
            <SiteHeader initialCartCount={cartCount} isLoggedIn={isLoggedIn} />
            {children}
            <SiteFooter />
          </ThemeProvider>
        </TranslationProvider>
      </body>
    </html>
  );
}
