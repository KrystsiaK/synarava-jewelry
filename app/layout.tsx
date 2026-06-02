import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Hanken_Grotesk, Playfair_Display, Courier_Prime } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
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

export const metadata: Metadata = {
  title: "Synarava",
  description: "Fresh commerce scaffold for Synarava on Next.js, Prisma, Postgres, Railway, S3, and Stripe.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawPreference = cookieStore.get("synarava-theme")?.value;
  const themePreference = isThemePreference(rawPreference) ? rawPreference : "system";
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
        <ThemeScript initialPreference={themePreference} />
        <ThemeProvider initialPreference={themePreference}>
          <SiteHeader key={`${themePreference}-${cartCount}`} initialCartCount={cartCount} />
          {children}
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
