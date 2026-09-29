# Shopify payment and checkout verification

- Status: **in progress**
- Last updated: **2026-09-29**
- Storefront: <https://shop.synarava.com>
- Commerce source of truth: **Shopify**

This is the living test plan and execution log for Synarava checkout and
payments. Record results here without customer email addresses, phone numbers,
street addresses, full payment details, or screenshots containing those data.

## Official references

- [Authenticate buyers in checkout (`sso=silent`)](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/checkout-authentication)
- [Webhook topic `ORDERS_PAID`](https://shopify.dev/docs/api/admin-graphql/latest/enums/WebhookSubscriptionTopic)
- [Testing Shopify Payments](https://help.shopify.com/en/manual/payments/shopify-payments/testing-shopify-payments)
- [Processing a test order](https://help.shopify.com/en/manual/checkout-settings/test-orders/processing-test-order)
- [MB WAY](https://help.shopify.com/en/manual/payments/shopify-payments/local-payment-methods/mb-way)
- [Multibanco](https://help.shopify.com/en/manual/payments/shopify-payments/local-payment-methods/multibanco)

Shopify recommends placing a test order after changing payment settings.

## Test-mode boundaries

- The purchase total must be greater than the equivalent of USD 1.
- Test transactions do not appear in payouts or reports.
- Do not fulfill test orders or buy shipping labels; labels can incur charges.
- PayPal Wallet is unavailable while Shopify Payments test mode is enabled.
- Multibanco does not work in Shopify Payments test mode. Its `pending -> paid`
  lifecycle requires a controlled live transaction.
- Shopify's current testing guide does not provide a deterministic 3DS test
  card or an MB WAY simulator. Do not substitute Stripe test-card contracts for
  Shopify documentation. Verify these flows in a controlled live test when
  available.
- Disable test mode after this matrix is complete so customers can make real
  card payments.

## Automated repository coverage

| Area | Coverage | Where |
| --- | --- | --- |
| `sso=silent` URL contract | Append, idempotency, existing query params | `lib/shopify/__tests__/checkout-url.test.ts` |
| Logged-in checkout URL | Guest keeps raw URL; signed-in appends `sso=silent` | `lib/shopify/__tests__/cart.test.ts` |
| Unavailable checkout UX | Alert and cart CTA; no silent redirect | `app/[locale]/checkout/__tests__/page.test.tsx` |
| `ORDERS_PAID` HMAC | Reject invalid signature before claiming delivery | `app/api/shopify/webhooks/orders/paid/__tests__/route.test.ts` |
| `ORDERS_PAID` deduplication | Duplicate claim returns `{ ok, duplicate }` | same |
| Receipt and subscription | Ops summary, delivery claim, subscription setup | `lib/shopify/__tests__/orders-paid-webhook.test.ts` |
| Shared webhook verification | HMAC verification primitive | `lib/shopify/__tests__/webhooks.test.ts` |

These tests do not exercise live Shopify Payments, issuer-driven 3DS, or local
payment methods.

## Manual execution log

### PT-001 — Successful card payment

- Status: **PASS with follow-ups**
- Executed: **2026-09-29**
- Shopify order: **#1002 (test order)**

Setup:

- Shopify Payments test mode enabled.
- Portugal delivery address and Standard / Padrão shipping selected.
- Test Visa ending `4242` used in Shopify Checkout.
- Product subtotal EUR 14.00; shipping EUR 5.99; total EUR 19.99.

Verified:

- [x] Shopify Checkout accepted the test card.
- [x] Shopify displayed the order-confirmation page.
- [x] Shopify Admin labels the order `Test order`.
- [x] Financial status is `Paid`.
- [x] Fulfillment status remains `Unfulfilled`.
- [x] Subtotal, shipping, and total agree across Checkout and Admin.
- [x] Merchant new-order email was delivered.
- [x] Buyer order-confirmation email was delivered in Portuguese.
- [x] Buyer email contains the correct order number, item quantity, subtotal,
  shipping, tax, total, and estimated delivery window.
- [ ] Storefront cart clearing verified after return from Shopify Checkout.
- [ ] No redundant login prompt verified in a clean signed-in session.
- [ ] `shopify.orders_paid` production log verified.
- [ ] One `ShopifyWebhookDelivery` row with `SUCCEEDED` verified.
- [ ] Duplicate webhook delivery verified as deduplicated.

### Remaining test-mode scenarios

| ID | Scenario | Test data / action | Pass criteria | Status |
| --- | --- | --- | --- | --- |
| PT-002 | Generic decline | Card `4000 0000 0000 0002` | Clear decline; no paid order; no `ORDERS_PAID` | Ready |
| PT-003 | Invalid CVC | Card `4000 0000 0000 0127` | Clear field/payment error; retry remains possible | Optional |
| PT-004 | Abandon checkout | Leave Checkout and return to shop | Cart remains usable; no paid webhook | Not run |
| PT-005 | Refund | Refund PT-001 from Shopify Admin | Shopify remains source of truth; no local Order is created | Not run |
| PT-006 | Mobile and signed-in checkout | Mobile Safari/Chrome with valid Customer Account session | Responsive flow; no redundant login when Shopify account cookie is valid | Not run |
| PT-007 | Paid webhook observability | Inspect app log and delivery receipt for PT-001 | One successful receipt and useful structured log | Not run |
| PT-008 | Paid webhook retry | Redeliver the same webhook where supported | Delivery recognized as duplicate; no repeated operation | Not run |
| PT-009 | Shop Pay test card | Add a Shopify test card with nickname beginning `test_card` | Successful test payment; no real capture | Optional |

### Controlled live scenarios

Run only after test mode is disabled. Use the lowest practical amount and
expect real payment/refund processing.

| ID | Scenario | Why live is required | Pass criteria | Status |
| --- | --- | --- | --- | --- |
| PL-001 | Small real card payment and refund | Final production-path confirmation | Paid order, webhook once, refund recorded | Not run |
| PL-002 | MB WAY | No official simulator is documented in the Shopify testing guide | Approval in banking app, paid order, webhook once | Not run |
| PL-003 | Multibanco `pending -> paid` | Multibanco is unavailable in test mode | Pending order becomes paid after payment; webhook only on paid | Not run |
| PL-004 | Issuer-driven 3DS | No deterministic Shopify test card is documented | Challenge completes and order becomes paid | Conditional |

## Findings and corrections

### PAY-001 — Product presentation data is not production-ready

- Severity: **Required before production launch**
- Observed in: merchant and buyer order emails for PT-001

The order email displayed all of the following:

- placeholder product name `Test Title`;
- a long generated-looking SKU;
- an unexpected unit-price string, `EUR 49.00 / 7 g`, beside a line priced at
  EUR 14.00.

This did not affect payment authorization or totals, but the misleading unit
price and placeholder title are visible to the buyer as well as staff. Because
Shopify owns product commerce fields, inspect the Shopify product/variant title,
SKU, and unit-price measurement before the store goes live. Do not mask the
value in an email template or create a local pricing override.

Acceptance criteria:

- the production product has its intended public title;
- the SKU is intentional and acceptable in notifications;
- unit-price measurement is either correct for the product or removed in
  Shopify;
- a new test order email no longer contains misleading price-per-weight data.

### PAY-002 — Portuguese Shop tracking CTA needs copy review

- Severity: **Required before production launch**
- Observed in: buyer order-confirmation email for PT-001

The purple Shop tracking button reads `Transferir para rastrear com Shop`. This
is understandable but unnatural for the intended action. Review the Shopify
notification translation/template and prefer native commerce wording such as
`Rastrear com Shop` or `Acompanhar com Shop`, depending on the actual action.
Also review the adjacent `ou Visite a nossa loja` capitalization while editing
the template.

Acceptance criteria:

- the CTA accurately describes whether it opens or installs Shop;
- European Portuguese wording is reviewed by a native speaker;
- the final button text is verified in a new buyer confirmation email.

### PAY-003 — Earlier matrix overstated test-mode coverage

Severity: **Documentation correction — resolved 2026-09-29**

The previous matrix treated 3DS, MB WAY, and Multibanco as ordinary test-mode
scenarios. The plan now separates documented Shopify test-mode behavior from
controlled live checks and explicitly records that Multibanco is unavailable in
test mode.

### PAY-004 — Store link in Shopify email bypasses the headless storefront

- Severity: **Required before production launch**
- Observed in: buyer order-confirmation email for PT-001

The `Visite a nossa loja` link resolves through Shopify's `shop.url` and opens
the Shopify-hosted storefront instead of `https://shop.synarava.com`. In the
Order confirmation notification template, replace only the storefront-link
destination with the canonical Synarava storefront URL. Keep Shopify-owned
`order_status_url` intact so `Visualizar a sua encomenda` continues to open the
secure order-status page.

The same `shop.url` pattern can exist in shipping, refund, abandoned-checkout,
and other customer notifications. Audit those templates before launch rather
than assuming this correction applies globally.

Remediation in Shopify Admin:

1. Open **Settings -> Notifications -> Customer notifications -> Order
   confirmation -> Edit code**.
2. Define one explicit headless storefront variable near the top of the
   template:

   ```liquid
   {% assign synarava_storefront_url = 'https://shop.synarava.com' %}
   ```

3. For the `Visite a nossa loja` link only, replace
   `href="{{ shop.url }}"` with
   `href="{{ synarava_storefront_url }}"`.
4. Do not replace `order_status_url`, customer-account order URLs, or Shop
   tracking URLs.
5. Preview the template, send a test email, save it, and verify the actual link
   target in the received message.
6. Repeat the link audit for the other customer notification templates.

Acceptance criteria:

- `Visite a nossa loja` opens `https://shop.synarava.com`;
- `Visualizar a sua encomenda` still opens the Shopify order-status page;
- Shop tracking remains a separate Shopify/Shop destination;
- a test email and a new test order confirm the final destinations;
- other customer notification templates contain no unintended `shop.url`
  storefront links.

## Paid webhook evidence

Successful deliveries should emit a structured log equivalent to:

```json
{"event":"shopify.orders_paid","topic":"orders/paid","shopifyWebhookId":"...","shopifyOrderId":"...","orderName":"#...","financialStatus":"paid","currency":"EUR","totalPrice":"...","duplicate":false}
```

Receipts live in `ShopifyWebhookDelivery`, keyed by the unique Shopify webhook
ID. They are confirmation and operational evidence, not a second Order store.

## Next action

Verify PT-001 webhook receipt and storefront post-checkout state, then run
PT-002 with the generic-decline card.
