# Post-purchase operations runbook

- Storefront: <https://shop.synarava.com>
- Checkout: <https://checkout.shop.synarava.com>
- Customer account: <https://account.shop.synarava.com>
- Spec: [`SHOPIFY_POST_PURCHASE_FLOWS.md`](../SHOPIFY_POST_PURCHASE_FLOWS.md)
- Payment matrix: [`payment-checkout-test-matrix.md`](./payment-checkout-test-matrix.md)
- Redirect theme: [`shopify/themes/synarava-redirect/README.md`](../shopify/themes/synarava-redirect/README.md)

## Daily staff checklist

1. Shopify Admin → **Orders** → filter **Customer request**.
2. Open each cancellation/return request banner.
3. Decide deliberately:
   - **Approve / Remove items** → verify qty, refund, restock, shipping/tax → submit refund.
   - **Decline** → customer-facing reason → decline.
   - **Mark resolved** only if handled outside Shopify (no email/mutation).
4. Confirm timeline entry + customer notification.
5. Do **not** fulfill Shopify Payments test orders or buy labels for them.

## Buy again containment (until bridge verified in production)

1. **Settings → Checkout → Configurations → Customize → Settings → Buy again button** — keep **hidden**. Do not re-enable until BA-* / RT-BA-* matrix passes on production domains **after** the Synarava redirect theme draft is validated (cart_link_id → headless permalink) and the cart-notice clear path is verified live (POST `/api/cart/buy-again-notice` via `fetch`, not a Server Action).
2. **Admin → Customer account → Orders — buyer actions → Buy again on Orders tab** — keep **off** (SiteSetting `account-orders-settings-v1`). Same freeze as Checkout BA.
3. After the redirect theme is **published** and BA checks pass, re-enable Buy again (Checkout + optional Orders tab toggle) and run BA-001…BA-012.

## Account Orders status fidelity

Headless `/profile?section=orders` reads **live** Customer Account API (no local Order store). Status chips + action labels are admin-editable under **Customer account** copy (`profile.orders.status.*`, `profile.orders.actions.*`). Owner still confirms Customer Account scopes and a manual matrix: cancel, refund, partial refund, Multibanco pending→paid, returns when `read_returns` is granted.

## Online Store → headless redirect (Phase 2 ops)

Theme sources are versioned at
[`shopify/themes/synarava-redirect/`](../shopify/themes/synarava-redirect/).
Do **not** publish until draft preview + validation matrix pass and there is an
**explicit publish confirmation**.

### Pack + upload draft

```bash
node scripts/pack-synarava-redirect-theme.mjs
# → shopify/themes/synarava-redirect/dist/synarava-redirect-theme.zip
```

1. Admin → **Online Store → Themes → Add theme → Upload zip**.
2. Customize unpublished theme → **Theme settings → Storefront**:
   - Hostname: `shop.synarava.com`
   - Custom redirects include `/[locale]/collections/all` → `/[locale]/shop`
3. **Preview** only — do not publish yet.

### Buy again behaviour (why the fork exists)

Shopify turns Buy again
`/pt/cart/66048797442397:1` into `/pt/cart?cart_link_id=…` before the theme
runs. The Synarava theme rebuilds `{variant}:{qty}` from Liquid `cart.items`
and redirects to
`https://shop.synarava.com/pt/cart/66048797442397:1?country=PT` so the Next.js
bridge runs. Ordinary `/cart` without `cart_link_id` does **not** import.

### Rollback to Horizon

1. Admin → Themes → previous **Horizon** (or last good theme) → **Publish**.
2. Hide Buy again again if it was enabled for the test window.
3. Keep the Synarava Redirect Theme as an unpublished draft for the next attempt.

### Validation (draft / controlled window)

See the RT-* matrix in the [theme README](../shopify/themes/synarava-redirect/README.md)
and BA-* rows in [`payment-checkout-test-matrix.md`](./payment-checkout-test-matrix.md).
Minimum: Buy again adds once, merge with existing headless cart, replay safe,
notice flash, PT/EN, `/collections/all` → shop, checkout + account +
challenge/checkpoint unchanged.

## Webhook observability

Treat cancel/refund/return lifecycle receipts as **ops scaffolding**, not ready
observability, until production confirms Order GIDs land correctly and
`read_returns` is granted for `RETURNS_REQUEST`.

| Topic | Route | Log event |
| --- | --- | --- |
| `orders/paid` | `/api/shopify/webhooks/orders/paid` | `shopify.orders_paid` |
| `orders/cancelled` | `/api/shopify/webhooks/orders/cancelled` | `shopify.orders_cancelled` |
| `refunds/create` | `/api/shopify/webhooks/refunds/create` | `shopify.refunds_create` |
| `returns/request` | `/api/shopify/webhooks/returns/request` | `shopify.returns_request` |

Receipts: `ShopifyWebhookDelivery` (dedupe by Shopify webhook id). Not a second Order store.

Order id on receipts must be an Order GID / order id — never the top-level
Return or Refund `admin_graphql_api_id`.

Reconcile / admin sync registers these when `APP_URL` + `SHOPIFY_WEBHOOK_SECRET` are set. Scopes: `read_orders` (paid/cancel/refund); `read_returns` for `RETURNS_REQUEST` (soft-gated via `missingReturnsScopes` — subscription skipped until granted).

## Failed webhook deliveries

1. Find `ShopifyWebhookDelivery` rows with `status = FAILED`.
2. Check app logs for the matching `shopify.*` event.
3. Redeliver from Shopify Admin if the topic supports it; expect `{ duplicate: true }` on success path for already-succeeded ids.
4. Never invent a local refund/cancel to “catch up” — fix sync and re-read Shopify.

## Privacy

Do not paste customer email, address, phone, or full payment details into this runbook or chat.
