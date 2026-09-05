# GA4 ecommerce setup

The production funnel uses two consent-aware sources and exactly one purchase
source:

- `view_item`, `add_to_cart`, and `begin_checkout` are emitted by the headless
  storefront into the GTM `dataLayer` after analytics consent.
- `purchase` is emitted only by Shopify's `checkout_completed` customer event.
- The local Stripe confirmation event is deliberately not forwarded to GTM.

## GTM configuration

In container `GTM-PT33DSG5`, keep the existing `GA4 — Synarava Shop` Google tag.
Add one Google Analytics event tag:

1. Event name: `{{Event}}`.
2. Measurement ID / Google tag: `G-9SN7WQKGE6`.
3. Enable sending ecommerce data from the Data Layer.
4. Trigger type: Custom Event.
5. Event-name regex: `^(view_item|add_to_cart|begin_checkout|purchase)$`.
6. Name it `GA4 — Ecommerce events`, test in Preview, then publish.

The storefront and Shopify pixel both push the same `ecommerce` object shape, so
the same GTM event tag handles all four events.

## Shopify purchase source

In Shopify Admin, open **Settings -> Customer events -> Add custom pixel**.
Create `Synarava GTM purchase`, paste the contents of
`shopify-gtm-purchase-pixel.js`, and set its privacy purpose to require
**Analytics** consent. Marketing and preferences are not required by this pixel.

Use Shopify Pixel Helper to test a test order. In GA4 DebugView, verify one
`purchase` containing `transaction_id`, `value`, `currency`, and `items`.
Repeating the Thank-you page must not create a second transaction; GA4 uses the
stable Shopify order ID as `transaction_id` for deduplication.

Never add email, phone, customer ID, names, postal addresses, checkout token, or
free-form notes to the data layer.
