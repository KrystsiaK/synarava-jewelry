# Shopify automation playbook

This playbook applies the Synarava build-versus-buy rule: use included Shopify
capabilities first, own small integrations in the storefront, and add paid
software only after volume or operational complexity proves the need.

## Recommended economical stack

| Need | Start with | Cost posture | Upgrade only when |
| --- | --- | --- | --- |
| Catalog, orders, customers, checkout | Shopify | Already core infrastructure | Never duplicate the source of truth |
| Operational workflows | Shopify Flow | Use the native app on the current paid plan | A missing trigger/action has measurable operational cost |
| First email lifecycle | Shopify Email / native marketing automations | Start native; verify the current plan allowance in Admin | Segmentation, deliverability, or revenue attribution materially outgrows it |
| Storefront behavior | Synarava event contract + consent-aware GTM/GA4 | Our lightweight adapter plus free analytics tier | Data volume or modeling requires a warehouse |
| Checkout behavior and purchase | Shopify Customer Events / Web Pixel | Native checkout event source | A server-side destination is justified by paid-media volume |
| Search performance | Search Console | Free | Never replace; optionally export later |
| Product listings | Merchant Center + Shopify catalog | Free entry point | Paid campaigns show positive contribution margin |
| Consent | Shopify Customer Privacy banner | Native asset; no separate CMP initially | Legal/market complexity exceeds Shopify configuration |
| Technical errors | Next.js structured logs + Web Vitals telemetry | Implemented in this repository | Alert volume justifies Sentry/Datadog or equivalent |
| Weekly reporting | Shopify/GA4/Search Console export + our digest | Build the small report ourselves | Manual joins exceed a few hours per month |

Do not install Klaviyo, a separate CMP, a customer-data platform, a paid BI
dashboard, a reviews suite, and multiple pixel apps on day one. Each adds script
weight, consent surface, duplicate attribution, and subscription cost.

## Naming convention

Use stable lower-case tags owned by automation:

- `synarava:first-order`
- `synarava:repeat-customer`
- `synarava:vip-candidate`
- `synarava:full-price`
- `synarava:discounted`
- `synarava:low-stock`
- `synarava:made-to-order`
- `synarava:review-requested`
- `synarava:winback-eligible`

Human-created merchandising tags must not use the `synarava:` prefix. This
keeps automated state auditable and prevents editorial changes from triggering
customer communication accidentally.

## P0 Flow recipes

### 1. Low-stock operations

Trigger: inventory quantity changed.

Conditions:

- product is active and published;
- available quantity is at or below the product threshold;
- product is not intentionally made-to-order.

Actions:

- add `synarava:low-stock`;
- send one internal notification containing product, variant, SKU, available
  quantity, and admin link;
- remove the tag automatically after stock exceeds the threshold.

Guardrails:

- do not unpublish the SEO page automatically;
- do not send repeat alerts while the tag is already present;
- use a different threshold for unique pieces and replenishable goods.

Measure: out-of-stock sessions, days unavailable, and replenishment lead time.

### 2. First versus repeat paid order

Trigger: order paid, not merely order created.

Conditions and actions:

- if the customer's paid-order count is one, tag the order/customer
  `synarava:first-order`;
- otherwise add `synarava:repeat-customer`;
- add department and full-price/discounted order tags from line items and
  discount state.

Guardrails:

- exclude test, cancelled, fully refunded, and imported historical orders from
  lifecycle messages;
- tags classify facts; email automation decides whether sending is permitted.

Measure: first-to-second-order rate and days to second order.

### 3. VIP candidate, not automatic discounting

Trigger: order paid or customer updated.

Condition: cumulative paid spend or paid-order count crosses a documented
threshold.

Action: add `synarava:vip-candidate` and notify the owner for review.

Guardrails:

- never issue a discount automatically;
- account for refunds and unusually high one-off orders;
- treat the tag as a service signal, not a promise to the customer.

Measure: repeat rate, gross margin, and support cost for the segment.

### 4. High-risk order review

Trigger: order risk or order created, depending on the Flow tasks available in
the current Shopify plan.

Condition: Shopify risk classification requires review.

Actions:

- hold manual fulfillment;
- notify operations with the Shopify order link;
- never copy payment or personal data into external chat tools.

Measure: prevented loss and false-positive review rate.

### 5. Fulfillment-delay warning

Trigger: order remains unfulfilled after the product/order promise window.

Actions:

- notify operations before the customer-facing deadline;
- tag the order for the support queue;
- send a customer message only through an approved template after human or
  rule-based confirmation of the new date.

Measure: on-time fulfillment and proactive-contact rate.

## P0 marketing automations

### Welcome

Entry: explicit marketing opt-in, including captured source.

Sequence:

1. Immediate brand orientation and the most useful shopping path.
2. Craft/material story after two to three days.
3. Product or collection discovery based on the signup context.

No automatic discount is required. Test value-led onboarding before training
customers to wait for promotions.

### Abandoned checkout

Use Shopify's canonical checkout state rather than a browser-only cart event.

- first reminder after the shopper has had a reasonable chance to complete;
- second message only when inventory and consent still allow it;
- suppress immediately after order, cancellation request, or unsubscribe;
- include a direct Shopify checkout recovery link;
- do not invent urgency or stock scarcity.

Measure recovered contribution margin, not attributed revenue alone.

### Post-purchase care

Entry: fulfilled/delivered state when available, otherwise a conservative delay
after fulfillment.

Select the message from product material/category. Link to the relevant care
page and order account. This is service first; cross-sell is secondary.

### Review or customer-photo request

Entry: expected delivery plus a grace period.

- send once;
- suppress for refunded, disputed, delayed, or support-sensitive orders;
- tag `synarava:review-requested` for idempotency;
- start with a reply or simple form before buying a reviews platform.

### Win-back

Entry: a meaningful inactivity interval after a completed order.

- segment by the product cycle rather than using one global delay;
- lead with new relevance, care, story, or replenishment;
- cap frequency and remove immediately after purchase.

## What Synarava should implement itself

These are small, differentiating, and portable:

- first-party event and telemetry contracts;
- PII filtering before analytics destinations;
- UTM naming and cart attribution attributes;
- Shopify/catalog reconciliation health checks;
- a weekly funnel and SEO opportunity digest;
- editorial content briefs from real demand data;
- automated tests proving events, structured data, and checkout continuity.

## What Synarava should not implement itself

These carry disproportionate security, compliance, or delivery risk:

- payment processing or card-data storage;
- email delivery infrastructure, bounce processing, and spam reputation;
- fraud scoring;
- consent storage that conflicts with Shopify checkout;
- ad-network identity matching;
- a general-purpose workflow engine while Shopify Flow covers the workflow.

## Activation order in Shopify Admin

1. Confirm the paid Shopify plan and install/enable Shopify Flow.
2. Confirm the production storefront and checkout share a root domain.
3. Create a **public** Storefront API token for Customer Privacy; never reuse the
   server-side private token.
4. Configure Shopify privacy regions and banner copy.
5. Enable the P0 Flow recipes one at a time with a test product/order.
6. Configure Shopify Customer Events/Web Pixel for checkout progression and
   completed purchase.
7. Connect the first native marketing automations with test-customer and
   suppression rules.
8. Run a complete test: acquisition URL -> product -> cart -> checkout -> paid
   order -> Flow tags -> analytics transaction -> lifecycle suppression.

Every automation needs an owner, an off switch, a test record, an idempotency
rule, and a metric. A workflow is not complete merely because it can run.
