# Privacy and cookie compliance audit

Date: 5 September 2026
Scope: repository implementation, local browser behaviour, and the public `https://synarava.com` domain
Jurisdiction baseline: EU GDPR, ePrivacy rules as implemented in Portugal, and Shopify Customer Privacy integration guidance

This is a technical compliance review, not a substitute for advice from Portuguese counsel.

## Executive conclusion

The public service is **not ready to be described as fully compliant** until this application is deployed and the legal/operator configuration is supplied. The repository remediation described below now provides a first-party consent manager, default denial, granular controls, withdrawal, optional-destination gating, a cookie inventory, and a deployment check. The public domain still serves a GoDaddy “Launching Soon” site: `https://synarava.com/privacy` returns a branded 404, the contact/newsletter form has no Synarava privacy-policy link, and the GoDaddy cookie rejection did not persist after a reload in the test session.

GTM and Meta Pixel now have optional, configuration-driven integration points. Neither destination is configured in the checked deployment environment, and both remain absent until a valid ID is supplied. When supplied, GTM is rendered only after analytics consent and Meta Pixel only after marketing consent.

## Repository remediation completed

- Added an always-available, bilingual first-party banner with equally accessible accept, reject, and granular choices; optional purposes default to off.
- Added a versioned 180-day consent record and a permanent footer control for review and withdrawal.
- Replaced the separate Shopify banner with Shopify Customer Privacy API synchronization to avoid competing consent interfaces.
- Prevented telemetry and commerce events from entering `dataLayer` before analytics consent.
- Added consent-gated GTM and Meta Pixel loaders and their CSP destinations.
- Stopped the theme preference cookie from being written before an explicit visitor choice.
- Expanded the notice with a concrete storage inventory, CNPD link, transfer safeguards, required-data consequence, automated-decision statement, and lawful update wording.
- Added `pnpm check:privacy`, deployment documentation, `/privacy` and `/offer` sitemap entries, and automated consent/CSP/telemetry tests.

Remaining external launch inputs are the controller's exact legal name and postal address, the production privacy contact, DNS/hosting cutover from GoDaddy, actual processor/retention verification, and any chosen GTM/Meta/email-provider identifiers and contracts.

## Findings

### P0 — Public domain has no accessible Synarava privacy notice

- `https://synarava.com/privacy` returned “Page Not Found” on 5 September 2026.
- The live GoDaddy contact form collects name, email, message, and an optional email-list opt-in.
- The only policy links displayed beside the form lead to Google’s reCAPTCHA privacy policy and terms, not Synarava’s notice.
- The live page therefore collects personal data without making the controller’s own Article 13 information readily available at collection time.

### P0 — Live GoDaddy cookie choice is not reliably persistent

- The live banner offers “Decline” and “Accept”, which is better than an accept-only banner.
- After selecting “Decline” and reloading the same page in the same browser session, the banner appeared again.
- There is no visible granular settings control or permanent “Cookie settings” link for reviewing or withdrawing consent.
- The page loads multiple GoDaddy/third-party scripts before a choice, including GoDaddy traffic/signals assets and Reamaze. Their exact storage and processing purposes are not documented on the page.

### P1 — Repository banner is configuration-optional and can silently disappear

- `app/layout.tsx` renders the Shopify banner only when three public configuration values are all truthy.
- Missing or invalid deployment configuration produces no user-facing fallback and no build/startup failure.
- In the local browser test, `/privacy` loaded successfully but no consent controls or Shopify banner script were present.
- Existing tests verify CSP allowance, but do not verify banner rendering, consent persistence, default denial, purpose-level choices, or withdrawal.

### P1 — Shopify consent is not connected to analytics/marketing destinations

- The official Shopify banner asset and `loadBanner()` call are present.
- There is no call to Shopify permission methods before starting a destination, no consent-state subscription, and no “show preferences” control.
- No GA4, GTM, Meta Pixel, or equivalent destination is currently installed.
- Commerce tracking currently emits a first-party browser event only; it does not transmit data. Web Vitals are pushed only into an in-memory `dataLayer` array.
- The intended work is explicitly still unchecked in `docs/growth-strategy.md`.

Shopify’s banner can propagate consent to Shopify-managed surfaces, but arbitrary third-party tags must still be gated by the corresponding allowed-processing state.

### P1 — Privacy notice is a draft, not a complete Article 13 notice

The repository page is structurally strong but omits or leaves too vague several operational facts:

- controller’s full legal identity and postal address (only “Synarava Jewelry” and an email are shown);
- concrete legitimate interests rather than a broad “improve the website” statement;
- actual hosting and object-storage vendors;
- international transfers and safeguards, where applicable;
- whether providing each data category is contractual/statutory and the consequence of not providing it;
- automated decision-making/profiling statement;
- specific retention periods or sufficiently usable criteria for most categories;
- a named Portuguese supervisory authority and complaint link;
- an actual mechanism for withdrawing cookie consent as easily as it was given;
- the live contact/newsletter processing and processors currently used on the GoDaddy page.

The sentence saying continued use constitutes acceptance of an updated policy should not be used as a substitute for fresh consent where a change introduces a new consent-based purpose.

### P1 — Cookie disclosure lacks an implementable inventory

The policy lists only three categories. It does not disclose cookie/storage names, provider, purpose, duration, first/third-party status, or the precise consent category. Repository storage includes at least:

- essential/authentication: customer session (14 days), Shopify customer session (30 days), OAuth transaction (10 minutes), admin session (8 hours);
- essential/commerce: local cart (30 days), Shopify cart (30 days), checkout access (6 hours), confirmation access (5 minutes);
- preferences: locale and theme (1 year), plus locale message cache in local storage;
- Shopify consent cookies when the privacy banner is enabled.

The theme provider writes a one-year theme cookie on mount even when the user has not actively changed the theme. This is unnecessary for the default “system” state and makes the “strictly necessary” classification harder to defend.

### P2 — Legal content is not localized

Switching the local application to Portuguese translated the navigation and footer but left the full privacy notice in English. For a Portugal-facing store, the legally relevant information should be available in clear Portuguese (and in the languages used to sell to other target markets).

### P2 — Marketing opt-in is not implemented in the new application

- The database contains `marketingOptIn` with a safe default of `false`.
- No application flow reads or writes this field.
- No newsletter subscription endpoint, consent evidence record, welcome flow, unsubscribe integration, or suppression logic was found.

Before promotional email is enabled, store evidence such as timestamp, source/form version, notice version, purpose, and withdrawal status, and provide a simple unsubscribe mechanism in every message.

## What is already good

- Optional analytics is described as consent-based in the draft policy.
- The Shopify banner uses Shopify’s official asset and passes the documented headless storefront/domain/token parameters.
- The checkout domain is added to CSP, and the focused CSP test passes.
- First-party session/cart/checkout cookies use `HttpOnly`, `SameSite=Lax`, production-only `Secure`, scoped paths, and bounded lifetimes where appropriate.
- The commerce event contract blocks common PII keys and does not currently transmit events.
- The database marketing flag defaults to opt-out.

## Required implementation order

1. **Fix the public domain first:** deploy this app (or publish an interim complete privacy notice) and remove/replace the GoDaddy collection form until Synarava’s notice is available at collection time.
2. **Make consent deployment-safe:** require valid Shopify privacy configuration in production, verify shared root domains, and fail closed for all optional destinations.
3. **Add persistent controls:** equal “Accept all” / “Reject all” choices, granular preferences, no preselected optional purposes, and a footer “Cookie settings” control calling Shopify’s preferences UI.
4. **Gate every destination:** start analytics only when analytics processing is allowed; start advertising/remarketing only when marketing processing is allowed; revoke/disable on consent changes.
5. **Complete the notice and cookie inventory:** replace placeholders with the real entity, address, vendors, transfers/safeguards, retention, CNPD link, and exact storage table.
6. **Implement marketing consent:** separate unchecked opt-in, evidence log, Shopify/email-platform synchronization, unsubscribe and suppression.
7. **Add automated tests:** no optional requests before consent, reject persistence, accept-by-purpose, withdrawal, locale coverage, checkout consent propagation, and a production-config guard.

## Verification performed

- Graphify query over the repository privacy/analytics/marketing relationships.
- Source review of the privacy page, banner loader, layout configuration, cookie writers, telemetry, commerce events, database opt-in field, CSP and growth plan.
- Local browser check of `/privacy`, including script presence and Portuguese locale switch.
- Public browser check of `https://synarava.com/` and `/privacy`, including the contact/newsletter form and decline/reload behaviour.
- Automated suite after remediation: 60 files, 351 tests passed; ESLint, TypeScript, and production webpack build passed.

## Primary references

- GDPR Article 13: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679
- CNPD cookie note (analytics cookies require consent under Article 5 of Portuguese Law 41/2004): https://www.cnpd.pt/media/x2zdus50/nota-informativa-cnpd_cookies_20210625.pdf
- CNPD consent guidance: https://www.cnpd.pt/organizacoes/areas-tematicas/consentimento/
- EDPB Cookie Banner Taskforce report: https://www.edpb.europa.eu/documents/task-force-report/report-of-the-work-undertaken-by-the-cookie-banner-taskforce_en
- Shopify Customer Privacy API and custom storefront installation: https://shopify.dev/docs/api/customer-privacy
