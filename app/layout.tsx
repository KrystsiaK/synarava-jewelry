import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Hanken_Grotesk, Playfair_Display, Courier_Prime } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import { TranslationProvider } from "@/lib/i18n/context";
import { getCartCount } from "@/lib/commerce/cart";
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

const mono = Courier_Prime({
  variable: "--font-courier",
  subsets: ["latin"],
  weight: ["400", "700"],
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
  const cookieStore = await cookies();
  const rawPreference = cookieStore.get("synarava-theme")?.value;
  const themePreference = isThemePreference(rawPreference) ? rawPreference : "system";
  const initialLocale = cookieStore.get("synarava-locale")?.value ?? "en";
  const cartCount = await getCartCount();

  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
      data-theme-preference={themePreference}
      data-theme="light"
      suppressHydrationWarning
    >
      <body>
        <script
          type="application/ld+json"
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
        <ThemeScript initialPreference={themePreference} />
        <TranslationProvider initialLocale={initialLocale}>
          <ThemeProvider initialPreference={themePreference}>
            <SiteHeader key={`${themePreference}-${cartCount}`} initialCartCount={cartCount} />
            {children}
            <SiteFooter />
          </ThemeProvider>
        </TranslationProvider>
      </body>
    </html>
  );
}
