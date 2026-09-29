# Post-purchase operations runbook

- Storefront: <https://shop.synarava.com>
- Checkout: <https://checkout.shop.synarava.com>
- Customer account: <https://account.shop.synarava.com>
- Spec: [`SHOPIFY_POST_PURCHASE_FLOWS.md`](../SHOPIFY_POST_PURCHASE_FLOWS.md)
- Payment matrix: [`payment-checkout-test-matrix.md`](./payment-checkout-test-matrix.md)

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

1. **Settings → Checkout → Configurations → Customize → Settings → Buy again button** — keep **hidden**. Do not re-enable until BA-* matrix passes on production domains **after** the cart-notice clear path is verified live (POST `/api/cart/buy-again-notice` via `fetch`, not a Server Action).
2. After bridge + Online Store redirect theme are live, re-enable and run BA-001…BA-012.

## Online Store → headless redirect (Phase 2 ops)

Do **not** publish the Online Store redirect theme yet. Keep Buy again hidden and the redirect unpublished until production BA checks pass.

When publishing Shopify’s redirect theme / Hydrogen-style redirect:

- Catalogue / product / collection / home / cart → `shop.synarava.com`
- Exclude: checkout, account, order status, payment, challenge/checkpoint
- Preserve locale + query string
- Never use Admin URL redirects for `/cart` (Shopify reserves it)

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
