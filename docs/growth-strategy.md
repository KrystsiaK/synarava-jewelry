# Synarava growth operating system

Status: working strategy, started 2026-08-27

## Objective

Build a measurable growth loop in which Shopify remains the commercial source
of truth, Synarava owns the editorial experience, and repetitive acquisition,
retention, reporting, and catalog operations are automated.

The system should answer five questions every week:

1. Which channels bring people who actually engage with products?
2. Where does the path from discovery to checkout lose them?
3. Which products, collections, stories, and search queries create demand?
4. Which lifecycle message brings a customer back without over-messaging them?
5. What should be made, stocked, promoted, or stopped next?

## Build-versus-buy rule

Prefer capabilities in this order:

1. A proven feature already included in Shopify or the current hosting stack.
2. A small, standards-based implementation we can own and test in this codebase.
3. A free, mature service with portable data and no storefront lock-in.
4. A paid service only after a measured bottleneck proves that buying is cheaper
   than building, operating, and maintaining the equivalent ourselves.

Do not pay for overlapping dashboards, basic webhooks, simple segmentation,
standard email sequences, tag management, or reports Shopify/GA4/Search Console
already provide. Do not custom-build deliverability infrastructure, payment
processing, fraud models, or ad-network APIs when a proven platform absorbs
material compliance and operational risk.

## Current baseline

### Already in place

- Shopify is the system of record for sellability, variants, price, inventory,
  publication, core media, and Shopify-supported SEO fields.
- Synarava preserves a separate editorial layer for symbolism, materials,
  process, lookbook, and art direction.
- The storefront uses the Shopify Storefront API for products, cart, and
  checkout, and the Customer Account API for customer identity.
- Product and inventory webhooks already pull Shopify changes into Synarava.
- The admin has explicit reconciliation and conflict resolution between Shopify
  and the local CMS.
- The site already emits first-party events for department entry, product view,
  add to cart, checkout start, and checkout completion.
- Robots, dynamic sitemap generation, canonical metadata, Open Graph metadata,
  Organization JSON-LD, and collection breadcrumbs exist.

### Main gaps

- Commerce events are not yet transmitted to an analytics destination.
- There is no shared consent state between the headless storefront and Shopify
  checkout.
- There is no acquisition attribution convention or weekly funnel report.
- Shopify webhooks cover catalog operations but not the complete order,
  customer, fulfillment, and lifecycle loop.
- A Shopify checkout completion is not yet reconciled into a canonical
  server-side purchase event for analytics.
- Product structured data, offer availability, and merchant-feed validation
  need a dedicated audit.
- Sitemap timestamps are generated at request time instead of using the real
  content update time.
- Locale selection is cookie-based; indexable locale URLs and `hreflang` are
  not yet part of the SEO architecture.
- Newsletter UI exists, but a complete subscription, welcome, post-purchase,
  review, and win-back lifecycle is not connected.

## Measurement architecture

### Source-of-truth hierarchy

| Question | Source of truth | Supporting source |
| --- | --- | --- |
| Orders, refunds, revenue, customers | Shopify | Synarava order projection |
| Product, variant, price, stock | Shopify | Synarava reconciliation state |
| On-site behavior and funnel | Consent-aware analytics | First-party event contract |
| Organic visibility | Google Search Console | Landing-page analytics |
| Product discovery in shopping surfaces | Merchant Center | Shopify catalog/feed health |
| Storefront speed | Real-user Web Vitals | Lab checks in CI |
| Editorial performance | Synarava CMS content IDs | Analytics landing/content fields |

Revenue must never be inferred from browser events when Shopify has the actual
order. Client analytics explains behavior; Shopify settles the commercial fact.

### Initial funnel

`qualified_session -> product_view -> add_to_cart -> begin_checkout -> purchase`

Segment every stage by:

- source / medium / campaign;
- landing page;
- department, category, collection, product, and variant;
- country, language, and device class;
- new versus returning customer;
- in-stock versus made-to-order;
- full-price versus discounted order.

### Event contract

Keep the current first-party browser event as the vendor-neutral source. An
adapter can send the same contract to GTM/GA4, a privacy-friendly analytics
tool, or a first-party endpoint without changing product components.

Minimum commerce payloads:

| Event | Required properties |
| --- | --- |
| `department_entry` | department, source |
| `view_item` | product ID/slug, variant ID when selected, SKU, name, numeric value, currency, collection, department, availability |
| `add_to_cart` | product and variant identifiers, quantity, numeric value, currency, cart ID/hash |
| `checkout_started` | cart ID/hash, item count, numeric value, currency, source |
| `checkout_completed` | Shopify order/checkout ID, transaction ID, numeric revenue, tax, shipping, currency, coupon, item snapshot |

Never send email, name, address, phone, raw customer ID, full Shopify cart
secret, or free-form customer notes to browser analytics.

### Operational telemetry

Commercial analytics and operational telemetry are separate streams:

- browser commerce events enter a vendor-neutral `dataLayer` and remain ready
  for a consent-aware analytics adapter;
- client errors record only error type and source location, never messages,
  stacks, form values, or query strings;
- Core Web Vitals and Next.js navigation timing enter the telemetry namespace;
- server-render and route errors produce structured deployment logs containing
  route patterns and error digests, but not request URLs, headers, messages, or
  stacks;
- instrumentation failure is isolated and must never block hydration, checkout,
  or navigation.

The next telemetry step is to choose the production destination, retention,
sampling, alert thresholds, and ownership. Until consent is connected, the
commerce `dataLayer` must not be transmitted to analytics vendors.

### Attribution convention

All controlled campaign links use lowercase UTMs:

- `utm_source`: platform or partner, for example `instagram`, `pinterest`,
  `newsletter`, `creator_name`;
- `utm_medium`: `organic_social`, `paid_social`, `email`, `affiliate`, `pr`;
- `utm_campaign`: stable launch/theme key, for example `heritage_aw26`;
- `utm_content`: creative or placement key;
- `utm_term`: paid-search term only.

Store first-touch and latest non-direct touch only after the relevant consent.
Include the attribution reference on the Shopify cart as a non-PII cart
attribute so the order can be reconciled server-side.

## Consent and privacy

Use Shopify Customer Privacy API as the consent authority for the custom
storefront and Shopify-managed checkout surfaces.

- Load Shopify's Customer Privacy asset on the custom storefront.
- Use a separate public Storefront API token for consent integration; never
  expose the existing private Storefront token.
- Configure storefront and checkout under a shared root domain so checkout can
  honor storefront consent.
- Start analytics and marketing destinations only when their corresponding
  processing purpose is allowed.
- Record consent only after an explicit visitor action.
- Keep essential cart, authentication, language, and security behavior separate
  from optional analytics and marketing processing.
- Have final banner copy, retention periods, and vendor list reviewed for the
  markets in which Synarava sells.

## Shopify as the automation brain

The implementation recipes and economical stack are maintained in
[`shopify-automation-playbook.md`](./shopify-automation-playbook.md).

### Shopify-native workflows

Start with Shopify Flow wherever a trigger, condition, and action already exist.
Flow is available as an optional app on paid Shopify plans, although individual
features and custom-app extensions can depend on plan.

P0 workflows:

1. Low inventory: when stock crosses a threshold, notify operations and tag the
   product `low-stock`; remove the tag after replenishment.
2. Out of stock: hide paid-campaign eligibility, keep the SEO page live when
   restock is expected, and expose a back-in-stock capture.
3. New paid order: tag first-time versus repeat customer, order department,
   acquisition campaign, and full-price versus discounted order.
4. High-value customer: apply a VIP candidate tag based on cumulative spend or
   order count; do not auto-send a discount.
5. Fulfillment delay: alert operations before the promised lead time is missed.
6. Catalog sync failure: notify operations when a product webhook or
   reconciliation event remains failed.

P1 lifecycle workflows:

1. Welcome series after explicit email opt-in.
2. Abandoned checkout reminder using Shopify's canonical checkout state.
3. Post-purchase care message based on product/material.
4. Review or customer-photo request after expected delivery plus a grace period.
5. Cross-sell based on department and owned product, not generic popularity.
6. Win-back after a product-cycle-appropriate inactivity window.
7. Back-in-stock notification with suppression after purchase.

P2 intelligence workflows:

1. Weekly digest of products with high views and low add-to-cart rate.
2. Weekly digest of checkout starts without corresponding Shopify purchases.
3. Detect products receiving traffic while unavailable or unpublished.
4. Identify organic landing pages with impressions but weak click-through rate.
5. Suggest content refreshes from real search queries and internal product
   demand; require editorial approval before publishing.

### Webhook expansion

Keep product and inventory webhooks, then add idempotent, signature-verified
handlers or managed Flow equivalents for:

- orders created, paid, cancelled, and refunded;
- fulfillments created and updated;
- customers created and updated;
- checkout and cart signals where Shopify exposes the needed lifecycle;
- app/privacy compliance topics if the integration becomes a distributed app.

Webhooks update facts and queues. They must not directly send duplicate customer
messages on retry; lifecycle actions need idempotency keys and suppression rules.

## SEO and content growth

### Technical SEO backlog

P0:

- add complete Product JSON-LD with Offer, price currency, availability, SKU,
  brand, canonical URL, and image set;
- ensure only public, canonical products and collections enter the sitemap;
- use real `updatedAt`/publication timestamps in the sitemap;
- validate Shopify product data and Merchant Center feed consistency;
- connect Search Console and submit the production sitemap;
- verify redirects for every Shopify/local handle change;
- add a default social-sharing image and validate per-product images.

P1:

- create indexable locale routes and `hreflang` only when translated pages are
  genuinely maintained;
- generate internal links among material, symbolism, collection, care, and
  related-product pages;
- add FAQ structured data only for visible, page-specific FAQs;
- make image alt text and filenames part of the CMS publishing checklist;
- add collection copy that serves an actual search intent without flattening the
  editorial voice.

### Content engine

Use Shopify facts plus Synarava's editorial layer to generate briefs, not
autopublished prose.

Each month, build a content map across four demand types:

1. Product intent: material + object + use/recipient.
2. Meaning intent: symbols, provenance, craft, and cultural context.
3. Care intent: sizing, materials, storage, cleaning, allergies, and durability.
4. Occasion intent: gifting, styling, seasonal moments, and collections.

Automate query collection, clustering, brief generation, internal-link
suggestions, stale-page detection, and reporting. Keep cultural claims, brand
voice, product promises, and final publication under human editorial approval.

## Reporting cadence

### Daily automated checks

- storefront availability and checkout reachability;
- Shopify catalog/webhook failures;
- products with traffic but invalid price, inventory, or publication state;
- analytics event-contract failures;
- paid destinations running without permitted consent.

### Weekly growth review

Use one page, comparing the latest complete seven days with the previous seven
days and a four-week baseline:

1. qualified sessions;
2. product-view rate;
3. add-to-cart rate per product view;
4. checkout-start rate per cart;
5. Shopify purchase conversion;
6. average order value and contribution margin when available;
7. new versus returning customer revenue;
8. organic clicks and non-brand query growth;
9. lifecycle revenue and unsubscribe/complaint rate;
10. top three insights, decisions, owners, and due dates.

Do not optimize to raw traffic. A channel is useful when it creates qualified
product discovery, purchases, or durable owned demand.

## 90-day delivery plan

### Days 1-14: trustworthy measurement

- [x] Audit the current Shopify, event, and SEO architecture.
- [x] Define the source-of-truth hierarchy, funnel, attribution, and PII rules.
- [x] Add the vendor-neutral `dataLayer` adapter.
- [x] Add privacy-minimized client/server error and Web Vitals telemetry.
- [ ] Enrich commerce events with stable product/variant IDs, numeric money, and
  currency.
- [ ] Integrate Shopify Customer Privacy API and consent UI.
- [x] Add the official Shopify Customer Privacy banner loader, disabled until
  its public token and shared storefront/checkout domains are configured.
- [ ] Connect GTM/GA4 only behind analytics consent.
- [ ] Configure Shopify checkout Web Pixel/Customer Events for canonical
  checkout progression and purchase completion.
- [ ] Reconcile browser checkout IDs with Shopify order events.
- [ ] Connect Search Console and Merchant Center.
- [ ] Capture a zero-week baseline before campaigns change.

Exit condition: a test order appears once in Shopify and once in reporting, with
the same transaction ID and no PII in analytics.

### Days 15-30: conversion and discoverability

- [ ] Build the weekly funnel/product/channel report.
- [ ] Audit mobile product-to-checkout journey and top failure states.
- [x] Complete Product JSON-LD and sitemap timestamp fixes.
- [ ] Validate catalog, availability, price, and image consistency in Merchant
  Center.
- [ ] Add first-touch/latest-touch attribution to the Shopify cart and order.
- [ ] Launch low-stock, sync-failure, and fulfillment-delay workflows.

Exit condition: every major funnel loss can be segmented by product and source,
and commercial data matches Shopify.

### Days 31-60: owned audience and lifecycle

- [ ] Connect a real newsletter opt-in with explicit consent and source.
- [ ] Launch welcome, abandoned checkout, post-purchase care, and review flows.
- [ ] Add back-in-stock capture and automation.
- [ ] Create customer/order tags that support repeatable segmentation.
- [ ] Establish suppression, frequency-cap, and test-order rules.

Exit condition: lifecycle flows are measurable, deduplicated, and can be paused
without code changes.

### Days 61-90: scalable acquisition

- [ ] Publish the first search-intent content cluster with product and editorial
  internal links.
- [ ] Launch a small creative/channel test using the UTM convention.
- [ ] Automate weekly SEO opportunity and funnel-anomaly digests.
- [ ] Create a repeatable campaign brief and post-campaign review.
- [ ] Allocate budget from contribution evidence rather than last-click ROAS
  alone.

Exit condition: Synarava has at least one repeatable acquisition loop and one
repeatable retention loop with known economics.

## Inputs needed before external connections

- production storefront URL and checkout domain;
- Shopify plan and installed sales/marketing apps;
- priority countries and languages for the next 90 days;
- existing GTM, GA4, Search Console, Merchant Center, Meta, Pinterest, email, or
  CRM accounts;
- current monthly sessions, orders, average order value, gross margin, return
  rate, and ad budget, even if some values are zero;
- fulfillment lead times and inventory thresholds;
- legal owner for privacy copy and market-specific consent review.

No secret values belong in this document or the repository. Configuration uses
named variables and the deployment secret store.
