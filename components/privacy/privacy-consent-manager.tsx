"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { AnimatedModal } from "@/components/ui/animated-modal";
import { ArtifactButton } from "@/components/ui/artifact-button";
import { useTranslations } from "@/lib/i18n/context";
import { initializeClientTelemetry, publishClientTelemetry } from "@/lib/telemetry/client";
import {
  createPrivacyConsent,
  OPEN_PRIVACY_PREFERENCES_EVENT,
  parsePrivacyConsent,
  PRIVACY_CONSENT_CHANGED_EVENT,
  PRIVACY_CONSENT_COOKIE,
  PRIVACY_CONSENT_MAX_AGE,
  serializePrivacyConsent,
  type PrivacyConsent,
  type PrivacyConsentChoices,
} from "@/lib/privacy/consent";

type ShopifyPrivacyConfig = {
  storefrontAccessToken: string;
  checkoutRootDomain: string;
  storefrontRootDomain: string;
};

type ShopifyConsent = {
  analytics?: "" | "yes" | "no";
  marketing?: "" | "yes" | "no";
  preferences?: "" | "yes" | "no";
};

type ShopifyCustomerPrivacy = {
  currentVisitorConsent(): ShopifyConsent;
  setTrackingConsent(
    consent: PrivacyConsentChoices & ShopifyPrivacyConfig & { headlessStorefront: true },
    callback: (result?: { error?: string[] }) => void,
  ): void;
};

declare global {
  interface Window {
    Shopify?: {
      loadFeatures(
        features: Array<{ name: string; version: string }>,
        callback: (error?: Error) => void,
      ): void;
      customerPrivacy?: ShopifyCustomerPrivacy;
    };
    dataLayer?: Array<Record<string, unknown>>;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const DEFAULT_CHOICES: PrivacyConsentChoices = {
  preferences: false,
  analytics: false,
  marketing: false,
};

const OPTIONAL_COOKIE_PREFIXES = ["_ga", "_gid", "_gat", "_fbp", "_fbc"];

function writeConsentCookie(consent: PrivacyConsent) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PRIVACY_CONSENT_COOKIE}=${serializePrivacyConsent(consent)}; Path=/; Max-Age=${PRIVACY_CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
}

function clearKnownOptionalCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name || !OPTIONAL_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

function consentFromShopify(value: ShopifyConsent): PrivacyConsent | null {
  const hasDecision = [value.analytics, value.marketing, value.preferences]
    .some((choice) => choice === "yes" || choice === "no");
  if (!hasDecision) return null;
  return createPrivacyConsent({
    analytics: value.analytics === "yes",
    marketing: value.marketing === "yes",
    preferences: value.preferences === "yes",
  });
}

function ConsentToggle({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 border-b border-stroke py-5 last:border-0">
      <span>
        <span className="label-caps block text-foreground">{label}</span>
        <span className="mt-1.5 block text-sm leading-6 text-foreground/65">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]"
      />
    </label>
  );
}

function ConsentDestinations({
  consent,
  gtmId,
  metaPixelId,
  nonce,
}: {
  consent: PrivacyConsent | null;
  gtmId?: string;
  metaPixelId?: string;
  nonce?: string;
}) {
  useEffect(() => {
    if (!consent?.analytics || !gtmId) return;
    window.dataLayer ??= [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  }, [consent?.analytics, gtmId]);

  return (
    <>
      {consent?.analytics && gtmId ? (
        <Script
          id="consent-aware-google-tag-manager"
          src={`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`}
          strategy="afterInteractive"
          nonce={nonce}
        />
      ) : null}
      {consent?.marketing && metaPixelId ? (
        <Script
          id="consent-aware-meta-pixel"
          strategy="afterInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(metaPixelId)});fbq('track','PageView');`,
          }}
        />
      ) : null}
    </>
  );
}

export function PrivacyConsentManager({
  initialConsent,
  shopifyConfig,
  gtmId,
  metaPixelId,
  nonce,
}: {
  initialConsent?: string;
  shopifyConfig?: ShopifyPrivacyConfig;
  gtmId?: string;
  metaPixelId?: string;
  nonce?: string;
}) {
  const { t } = useTranslations();
  const [consent, setConsent] = useState<PrivacyConsent | null>(() => parsePrivacyConsent(initialConsent));
  const [draft, setDraft] = useState<PrivacyConsentChoices>(() => consent ?? DEFAULT_CHOICES);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const previousConsent = useRef(consent);

  const syncShopify = useCallback((next: PrivacyConsent) => {
    const api = window.Shopify?.customerPrivacy;
    if (!api || !shopifyConfig) return;
    api.setTrackingConsent(
      {
        analytics: next.analytics,
        marketing: next.marketing,
        preferences: next.preferences,
        headlessStorefront: true,
        ...shopifyConfig,
      },
      (result) => {
        if (result?.error?.length) {
          publishClientTelemetry("client_error", { errorType: "ShopifyConsentSyncError" });
        }
      },
    );
  }, [shopifyConfig]);

  const save = useCallback((choices: PrivacyConsentChoices) => {
    const next = createPrivacyConsent(choices);
    const isWithdrawal = Boolean(
      previousConsent.current
      && ((previousConsent.current.analytics && !next.analytics)
        || (previousConsent.current.marketing && !next.marketing)),
    );
    writeConsentCookie(next);
    if (isWithdrawal) clearKnownOptionalCookies();
    previousConsent.current = next;
    setConsent(next);
    setDraft(next);
    setPreferencesOpen(false);
    window.dispatchEvent(new CustomEvent(PRIVACY_CONSENT_CHANGED_EVENT, { detail: next }));
    syncShopify(next);
    if (isWithdrawal) window.location.reload();
  }, [syncShopify]);

  useEffect(() => {
    initializeClientTelemetry();
    const openPreferences = () => {
      setDraft(consent ?? DEFAULT_CHOICES);
      setPreferencesOpen(true);
    };
    window.addEventListener(OPEN_PRIVACY_PREFERENCES_EVENT, openPreferences);
    return () => window.removeEventListener(OPEN_PRIVACY_PREFERENCES_EVENT, openPreferences);
  }, [consent]);

  function initializeShopifyPrivacy() {
    if (!window.Shopify?.loadFeatures) return;
    window.Shopify.loadFeatures(
      [{ name: "consent-tracking-api", version: "0.1" }],
      (error) => {
        if (error) {
          publishClientTelemetry("client_error", { errorType: "ShopifyPrivacyApiLoadError" });
          return;
        }
        const customerPrivacy = window.Shopify?.customerPrivacy;
        if (!customerPrivacy) return;
        const shopifyConsent = consentFromShopify(customerPrivacy.currentVisitorConsent());
        if (!consent && shopifyConsent) {
          writeConsentCookie(shopifyConsent);
          previousConsent.current = shopifyConsent;
          setConsent(shopifyConsent);
          setDraft(shopifyConsent);
        } else if (consent) {
          syncShopify(consent);
        }
      },
    );
  }

  return (
    <>
      {shopifyConfig ? (
        <Script
          id="shopify-customer-privacy-api"
          src="https://cdn.shopify.com/shopifycloud/consent-tracking-api/v0.1/consent-tracking-api.js"
          strategy="afterInteractive"
          nonce={nonce}
          onReady={initializeShopifyPrivacy}
          onError={() => publishClientTelemetry("client_error", { errorType: "ShopifyPrivacyScriptError" })}
        />
      ) : null}

      <ConsentDestinations consent={consent} gtmId={gtmId} metaPixelId={metaPixelId} nonce={nonce} />

      {!consent && !preferencesOpen ? (
        <section
          aria-labelledby="privacy-consent-title"
          className="fixed inset-x-3 bottom-3 z-[70] border border-foreground/20 bg-background/96 p-5 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-w-xl sm:p-7"
          data-slot="privacy-consent-banner"
        >
          <p className="label-mono text-accent">{t("privacyConsent.eyebrow")}</p>
          <h2 id="privacy-consent-title" className="mt-3 font-serif text-2xl leading-tight">
            {t("privacyConsent.title")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-foreground/70">
            {t("privacyConsent.description")} {" "}
            <Link href="/privacy#cookies" className="underline underline-offset-4 hover:text-foreground">
              {t("privacyConsent.policyLink")}
            </Link>
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ArtifactButton size="sm" variant="secondary" onClick={() => save({ preferences: true, analytics: true, marketing: true })}>
              {t("privacyConsent.acceptAll")}
            </ArtifactButton>
            <ArtifactButton size="sm" variant="secondary" onClick={() => save(DEFAULT_CHOICES)}>
              {t("privacyConsent.rejectAll")}
            </ArtifactButton>
            <ArtifactButton size="sm" variant="secondary" onClick={() => setPreferencesOpen(true)}>
              {t("privacyConsent.customize")}
            </ArtifactButton>
          </div>
        </section>
      ) : null}

      <AnimatedModal
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        ariaLabelledBy="privacy-preferences-title"
        zIndexClassName="z-[80]"
        backdropZIndexClassName="z-[75]"
        className="pointer-events-auto max-h-[min(46rem,calc(100vh-3rem))] w-full max-w-2xl overflow-y-auto border border-foreground/20 bg-background p-6 shadow-2xl sm:p-8"
      >
        <p className="label-mono text-accent">{t("privacyConsent.eyebrow")}</p>
        <h2 id="privacy-preferences-title" className="mt-3 font-serif text-3xl leading-tight">
          {t("privacyConsent.preferencesTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-foreground/70">{t("privacyConsent.preferencesDescription")}</p>
        <div className="mt-6 border-y border-stroke">
          <ConsentToggle checked disabled label={t("privacyConsent.necessaryTitle")} description={t("privacyConsent.necessaryDescription")} />
          <ConsentToggle checked={draft.preferences} onChange={(preferences) => setDraft((value) => ({ ...value, preferences }))} label={t("privacyConsent.preferenceTitle")} description={t("privacyConsent.preferenceDescription")} />
          <ConsentToggle checked={draft.analytics} onChange={(analytics) => setDraft((value) => ({ ...value, analytics }))} label={t("privacyConsent.analyticsTitle")} description={t("privacyConsent.analyticsDescription")} />
          <ConsentToggle checked={draft.marketing} onChange={(marketing) => setDraft((value) => ({ ...value, marketing }))} label={t("privacyConsent.marketingTitle")} description={t("privacyConsent.marketingDescription")} />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <ArtifactButton size="sm" variant="secondary" onClick={() => save(DEFAULT_CHOICES)}>{t("privacyConsent.rejectAll")}</ArtifactButton>
          <ArtifactButton size="sm" variant="primary" onClick={() => save(draft)}>{t("privacyConsent.save")}</ArtifactButton>
        </div>
      </AnimatedModal>
    </>
  );
}
