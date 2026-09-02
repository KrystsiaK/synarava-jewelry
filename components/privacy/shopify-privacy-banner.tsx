"use client";

import Script from "next/script";

import type { Locale } from "@/lib/i18n/locales";
import { publishClientTelemetry } from "@/lib/telemetry/client";

type ShopifyPrivacyBannerProps = {
  storefrontAccessToken: string;
  checkoutRootDomain: string;
  storefrontRootDomain: string;
  locale: Locale;
};

declare global {
  interface Window {
    privacyBanner?: {
      loadBanner(config: {
        storefrontAccessToken: string;
        checkoutRootDomain: string;
        storefrontRootDomain: string;
        locale: string;
      }): Promise<void>;
    };
  }
}
export function ShopifyPrivacyBanner({
  storefrontAccessToken,
  checkoutRootDomain,
  storefrontRootDomain,
  locale,
}: ShopifyPrivacyBannerProps) {
  function loadBanner() {
    if (!window.privacyBanner) return;

    void window.privacyBanner.loadBanner({
      storefrontAccessToken,
      checkoutRootDomain,
      storefrontRootDomain,
      locale,
    }).catch(() => {
      publishClientTelemetry("client_error", {
        errorType: "ShopifyPrivacyBannerLoadError",
      });
    });
  }

  return (
    <Script
      id="shopify-privacy-banner"
      src="https://cdn.shopify.com/shopifycloud/privacy-banner/storefront-banner.js"
      strategy="afterInteractive"
      onReady={loadBanner}
    />
  );
}
