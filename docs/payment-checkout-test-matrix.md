# Payment / checkout test matrix

Canon storefront: https://shop.synarava.com  
Shopify remains source of truth for payments and orders.  
Related follow-up: Project store `docs/payment-checkout-followup.md`.

Official references:
- [Authenticate buyers in checkout (`sso=silent`)](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/checkout-authentication)
- [Webhook topic `ORDERS_PAID`](https://shopify.dev/docs/api/admin-graphql/latest/enums/WebhookSubscriptionTopic)
- [Shopify: processing a test order](https://help.shopify.com/en/manual/checkout-settings/test-orders/processing-test-order) — Shopify recommends a test order after each payment-settings change.

## Automated in-repo (CI / vitest)

| Area | Coverage | Where |
|------|----------|--------|
| `sso=silent` URL contract | Append / idempotent / existing query params | `lib/shopify/__tests__/checkout-url.test.ts` |
| Logged-in checkout URL | Guest keeps raw URL; signed-in appends `sso=silent` | `lib/shopify/__tests__/cart.test.ts` |
| Unavailable checkout UX | Renders alert + cart CTA; no silent redirect | `app/[locale]/checkout/__tests__/page.test.tsx` |
| ORDERS_PAID HMAC | 401 before claim | `app/api/shopify/webhooks/orders/paid/__tests__/route.test.ts` |
| ORDERS_PAID dedup | Duplicate claim → `{ ok, duplicate }` | same |
| ORDERS_PAID receipt + subscribe | Summarize ops fields; claim; `ensureOrdersPaidWebhookSubscription` | `lib/shopify/__tests__/orders-paid-webhook.test.ts` |
| Webhook HMAC primitive | Shared verifier | `lib/shopify/__tests__/webhooks.test.ts` |

These do **not** exercise live Shopify Payments, 3DS, or local methods.

## Owner / manual — needs Kiryl’s Shopify Payments + test credentials

Run against production or a Shopify test mode store with Synarava Customer Accounts enabled. Confirm Admin conflict-check has registered `ORDERS_PAID` (requires `APP_URL`, `SHOPIFY_WEBHOOK_SECRET`, and `read_orders`).

| # | Scenario | Owner steps | Pass criteria |
|---|----------|-------------|---------------|
| 1 | Successful card | Logged-in buyer → cart → Checkout → Bogus/test Visa success | No re-login prompt; order paid in Shopify; server log `shopify.orders_paid`; one `ShopifyWebhookDelivery` SUCCEEDED |
| 2 | Card decline | Same path with decline test card | Decline message in Checkout; no ORDERS_PAID (or unpaid order only) |
| 3 | 3DS challenge | Card that triggers 3DS; complete challenge | Order paid after challenge; ORDERS_PAID once |
| 4 | Cancel checkout | Open Checkout, abandon / return to shop | Cart intact; no paid webhook |
| 5 | Refund | Paid order → Admin full refund | Shopify refund SoT; Synarava does **not** store a local Order (ops signal was paid only) |
| 6 | MB WAY | Enable MB WAY; complete test pay | Paid in Shopify; ORDERS_PAID |
| 7 | Multibanco pending→paid | Start Multibanco; wait/simulate paid | Pending then paid; ORDERS_PAID on paid; dedup on Shopify retry |
| 8 | Mobile checkout + re-login | Mobile Safari/Chrome; Customer Account session; Checkout with `sso=silent` | Stays logged in at Checkout when Customer Accounts cookie is valid |

### Credentials / access the agent cannot use

- Shopify Payments test mode (or Bogus Gateway) on the Synarava shop
- MB WAY / Multibanco enabled for Portugal where applicable
- Customer Account login for a real buyer session on shop.synarava.com
- Access to production/app logs to confirm `event":"shopify.orders_paid"`
- Ability to trigger Admin “conflict check” / sync so `ensureOrdersPaidWebhookSubscription` runs once in the target env

## Observability

Paid deliveries emit a structured log line:

```json
{"event":"shopify.orders_paid","topic":"orders/paid","shopifyWebhookId":"...","shopifyOrderId":"...","orderName":"#…","financialStatus":"paid","currency":"EUR","totalPrice":"…","duplicate":false}
```

Receipts live in `ShopifyWebhookDelivery` (webhook id unique) — confirmation/ops only, not a parallel Order commerce store.
