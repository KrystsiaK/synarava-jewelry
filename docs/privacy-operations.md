# Privacy and consent operations

The storefront owns the consent UI and stores a versioned decision in
`synarava-consent` for 180 days. Optional destinations are disabled by default.
Visitors can reject all optional purposes from the first layer, choose purposes
individually in the first-visit modal, and reopen the same controls anytime at
`/cookie-settings` (footer “Cookie settings”, Privacy Policy links, or any
WYSIWYG `/cookie-settings` href).

## Production configuration

Set these public, non-secret deployment values:

- `NEXT_PUBLIC_SITE_URL` — canonical HTTPS storefront URL.
- `NEXT_PUBLIC_LEGAL_NAME` — full legal name of the controller.
- `NEXT_PUBLIC_LEGAL_POSTAL_ADDRESS` — controller postal address shown in the notice.
- `NEXT_PUBLIC_PRIVACY_EMAIL` — monitored privacy-rights address.

Optional destinations:

- `NEXT_PUBLIC_GTM_ID` — loaded only after analytics consent.
- `NEXT_PUBLIC_META_PIXEL_ID` — loaded only after marketing consent.

Shopify consent synchronization is enabled only when all three existing public
Shopify privacy values are present: storefront access token, checkout root domain,
and storefront root domain. The API-only Shopify consent asset is used; the
storefront does not load Shopify's second, competing banner.

The Shopify custom pixel documented in
`docs/analytics/shopify-gtm-purchase-pixel.js` must be configured in Shopify to
require Analytics consent. It is the only production source of GA4 `purchase`;
the pixel deliberately excludes customer contact, address, and account data.

Run `pnpm check:privacy` in the production deployment environment before release.
It reports only missing variable names and configuration status, never values.

## Release checks

1. Point `synarava.com` and `www.synarava.com` at this application and verify `/privacy`.
2. In a clean browser profile, confirm there are no requests to Google Analytics,
   Google Tag Manager, or Meta before a choice.
3. Reject optional cookies, reload, and confirm the banner stays dismissed and no
   optional destination is contacted.
4. Enable analytics alone and confirm GTM loads while Meta does not.
5. Enable marketing, then withdraw it from `/cookie-settings` (footer link) and
   confirm optional cookies are removed and the page reloads without Meta.
6. Repeat the flow in English and Portuguese and on mobile keyboard/screen-reader paths.
7. Confirm a Privacy Policy or WYSIWYG link with href `/cookie-settings` opens the
   settings page (not a second modal).
8. Record the deployed policy version, vendor contracts, retention settings, and
   international-transfer safeguards in the internal processing register.
9. Complete a Shopify test order with analytics accepted, confirm exactly one
   `purchase` in GA4 DebugView, then repeat with analytics rejected and confirm
   that no Google pixel runs in Shopify checkout.

Marketing email must remain off until a chosen email provider records source,
policy version, consent timestamp, and withdrawal/unsubscribe evidence. The local
`marketingOptIn` boolean alone is not sufficient evidence and is not used as an
email-send authorization.

## Customer session retention

`ShopifyCustomerSession` rows hold encrypted Shopify tokens and are retained
only for the lifetime of the session:

- Absolute lifetime: 30 days from sign-in (`sessionExpiresAt`), independent of
  how often the Shopify access token is refreshed. Refreshing never extends it.
- Idle timeout: a session with no activity for 14 days is treated as
  abandoned and invalidated even if the absolute TTL has not elapsed.
- Expired rows are deleted opportunistically on the next sign-in
  (`cleanupExpiredCustomerSessions` in `lib/shopify/customer-account/session-store.ts`)
  rather than on a platform schedule, since this deployment has no cron runner.
- A session is deleted immediately (not just treated as signed-out) when its
  tokens fail to decrypt, when a Shopify token refresh fails, or when Shopify
  confirms the access token is no longer valid (`401`).
- Session records never appear in logs; failures are logged without the
  session id, access token, refresh token, or ID token.
