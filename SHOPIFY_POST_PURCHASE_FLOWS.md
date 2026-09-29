# Shopify post-purchase flows

- Status: **phase 1 eng shipped; ops phases open**
- Last updated: **2026-09-29**
- Storefront: <https://shop.synarava.com>
- Shopify checkout: <https://checkout.shop.synarava.com>
- Shopify customer accounts: <https://account.shop.synarava.com>
- Commerce source of truth: **Shopify**

This document defines the remaining work for the customer journey after an
order is placed, with particular focus on Shopify's **Buy again**
(`Comprar novamente`) and **Cancel items** (`Cancelar itens`) actions.

The customer-account and order-status pages are intentionally hosted by
Shopify. Opening `account.shop.synarava.com` is therefore correct. The defect is
not that these pages are Shopify-rendered; the defect is that some links from
them currently lead into Shopify's Online Store instead of returning to the
headless Synarava storefront.

## Goals

1. A customer can view and manage a Shopify order on the branded customer
   account domain without encountering an unbranded or dead storefront path.
2. **Buy again** recreates the requested items in the Synarava cart and lands
   on the localized Synarava cart page.
3. **Cancel items** uses Shopify's native request, review, refund, restock, and
   notification workflow.
4. Shopify remains the only order and commerce system of record. Local state
   is limited to storefront cart state, short-lived replay protection, and
   operational telemetry.
5. Partial failures, unavailable merchandise, repeated links, and expired
   eligibility are visible and recoverable rather than silently ignored.

## Non-goals

- Do not create a local Order, Cancellation, Return, Refund, or Fulfillment
  model that competes with Shopify.
- Do not directly cancel a paid order from a customer-facing endpoint.
- Do not rewrite secure `order_status_url`, Shop tracking, checkout, payment,
  challenge, or customer-account destinations to the Next.js storefront.
- Do not reproduce Shopify's refund, restock, tax, or fulfillment calculations.
- Do not make Shopify's Online Store theme a second browsable catalogue.

## Current state

### What is already correct

- `shop.synarava.com` is the canonical headless storefront.
- `checkout.shop.synarava.com` is the primary domain for Shopify's Online Store
  surface used by checkout.
- `account.shop.synarava.com` is the branded customer-account domain.
- The order-confirmation notification keeps `order_status_url` intact and uses
  the headless URL only for ordinary "visit the store" links.
- The headless profile reads customer orders through the Customer Account API.
- The headless profile links each order to Shopify's `statusPageUrl`.
- A custom Shopify return request already exists through
  `orderRequestReturn`, exposed by `app/api/orders/return/route.ts`.
- Paid-order confirmation is observed through the existing HMAC-verified and
  deduplicated `orders/paid` webhook.

### What is missing or inconsistent

1. ~~Cart permalink bridge~~ — shipped: `/{locale}/cart/[permalink]` imports
   Shopify `variant:qty` lists into the Storefront API cart with replay
   protection and cart notices. Notice cookie is read in the cart RSC and
   cleared via a Server Action (RSC cannot `cookies().set`).

2. Online Store → headless redirect theme is still **unpublished**. Publish only
   after production BA checks; keep Buy again hidden until then. Do not treat
   lifecycle webhook receipts as ready observability until Order-id parsing and
   `read_returns` scope gating are verified in production.

3. Headless profile now routes order management to Shopify (`statusPageUrl`) and
   no longer surfaces the custom return form. Confirm native return/cancel in
   Shopify Admin before re-enabling Buy again.

4. The order-status page can still expose product, collection, home, and cart
   links owned by the Shopify Online Store theme until the redirect theme is
   published with the exclusions in the routing policy.

## Product decisions

| Area | Decision |
| --- | --- |
| Order details | Keep Shopify's branded account/order-status experience as the canonical detailed order view. |
| Buy again | Bridge Shopify cart permalinks into the existing Synarava Storefront API cart. |
| Existing Synarava cart | Merge requested quantities once; do not discard an existing cart. |
| Repeated GET/reload | Use short-lived replay protection so refreshing the landing URL does not add the same quantities again. |
| Partial availability | Add eligible items, keep the customer on the cart, and clearly report skipped/adjusted items. |
| Cancellation | Keep the native Shopify request-and-review flow. Never auto-cancel or auto-refund from Synarava. |
| Returns | Make Shopify account management canonical in phase 1; decide whether to retire the duplicate custom return form after parity testing. |
| Shopify Online Store | Keep it active for checkout infrastructure, but prevent it from becoming a competing catalogue. |

## Flow A: Buy again

### Intended customer sequence

1. The signed-in customer opens an order at
   `account.shop.synarava.com`.
2. Shopify renders **Comprar novamente**.
3. Shopify sends the browser to its documented localized cart permalink,
   containing one or more numeric variant IDs and quantities.
4. The Online Store routing layer sends only this storefront-cart path to the
   equivalent Synarava URL without changing checkout/account URLs.
5. Synarava validates the locale and permalink, converts each numeric variant
   ID to `gid://shopify/ProductVariant/<id>`, and asks Shopify to add the lines
   to the current Storefront API cart.
6. Synarava stores a short-lived, server-controlled replay receipt for the
   canonical permalink and redirects to `/{locale}/cart`.
7. The cart displays the imported items and a localized result message:
   complete success, partial success with skipped items, quantity adjustment,
   or failure with a recovery action.
8. Checkout continues through the existing Shopify checkout URL and preserves
   the existing `sso=silent` behavior for an authenticated buyer.

### Immediate containment before implementation

Temporarily hide **Buy again** in Shopify until this bridge is deployed. Shopify
exposes the toggle in **Settings -> Checkout -> Configurations -> Customize ->
Settings -> Buy again button**. Leaving a known-broken action visible is worse
than temporarily removing it.

Re-enable the button only after the production-domain tests below pass.

### Required application changes

The exact filenames can change during implementation, but the boundaries
should remain explicit.

1. Add a pure parser, for example `lib/shopify/cart-permalink.ts`.

   - Accept the Shopify contract `<variant_id>:<quantity>` separated by commas.
   - Accept only ASCII digits for IDs and positive base-10 integer quantities.
   - Apply explicit limits for URL length, line count, per-line quantity, and
     total quantity.
   - Reject empty segments, unknown syntax, overflow, negative/zero quantities,
     fragments, and line-item property payloads until deliberately supported.
   - Combine duplicate variant IDs deterministically before calling Shopify.
   - Return typed error codes; never expose raw Shopify/network errors to the
     customer.

2. Add a localized landing route for Shopify's path shape, for example:

   ```text
   app/[locale]/cart/[permalink]/route.ts
   ```

   This route is a mutating `GET` only because Shopify owns the link contract.
   It must therefore include replay protection, rate limiting, `no-store`
   behavior, and an immediate redirect to the canonical cart URL.

3. Add a commerce-domain operation such as
   `addStorefrontMerchandiseLinesToCart(lines)`.

   - Keep `lib/commerce/storefront-cart.ts` as the app-facing boundary.
   - Extend `lib/shopify/cart.ts` with a multi-line Shopify cart mutation.
   - Continue using the Storefront API cart cookie rather than creating a
     second cart model.
   - Preserve Shopify warnings and user errors as structured results.
   - Validate merchandise against Shopify and the local visible-product
     projection. A numeric ID in a URL is not authorization to add hidden,
     archived, or unavailable merchandise.

4. Add a server-controlled cart notice.

   - Prefer a short-lived HttpOnly flash cookie containing only a result code
     and safe counts, then clear it after display.
   - Translate all messages in every supported storefront locale.
   - Do not put raw product titles, GraphQL errors, tokens, or customer data in
     query parameters.
   - Display the notice in or directly above the cart, with `role="status"` for
     success and `role="alert"` for failures.

5. Add replay protection.

   - Hash the canonical locale plus normalized line list.
   - Store only the hash and a short expiration in a secure, SameSite cookie.
   - If the same permalink is replayed during the window, redirect without
     adding it again and show an "already added" message.
   - Treat the receipt as UX safety, not as a security boundary. Shopify cart
     mutations and availability remain authoritative.

6. Route Shopify Online Store traffic only after the bridge exists.

   - Review Shopify's Hydrogen redirect theme as the official reference for
     preserving checkout and bot-protection behavior.
   - Because Synarava is a Next.js/Vercel storefront rather than an Oxygen
     Hydrogen environment, review the theme code and Shopify support boundary
     before publishing it; do not assume the domain-target workflow for a
     Hydrogen environment applies unchanged.
   - Configure ordinary Online Store catalogue paths to return to
     `shop.synarava.com` while excluding checkout, account, order status,
     payment, challenge/checkpoint, and other Shopify system paths.
   - Verify locale and query-string preservation.
   - Never use Shopify URL redirects for this cart route: Shopify reserves
     `/cart` and `/carts`, so ordinary admin URL redirects cannot solve it.

### Buy-again failure policy

| Condition | Customer result | Operational result |
| --- | --- | --- |
| Valid and fully available | All quantities added; localized success notice | `shopify.buy_again.completed` |
| Some variants unavailable | Available lines added; skipped count and guidance shown | `shopify.buy_again.partial` |
| Shopify reduces quantity | Cart shows authoritative quantity; adjustment notice shown | `shopify.buy_again.adjusted` |
| Invalid/malicious permalink | Nothing added; safe invalid-link message | `shopify.buy_again.rejected` with reason code |
| Shopify/network unavailable | Existing cart preserved; retry guidance shown | `shopify.buy_again.failed` |
| Immediate replay/refresh | Nothing added again; cart opens normally | `shopify.buy_again.replayed` |

Logs must contain correlation ID, locale, safe outcome code, line counts, and
latency. Do not log customer identity, email, address, access tokens, the cart
cookie, or full checkout/account URLs.

## Flow B: Cancel items

The observed **Cancelar itens** button means Shopify currently considers at
least one unfulfilled line eligible for a cancellation request. It does **not**
cancel the order immediately.

### Intended customer and merchant sequence

1. The customer opens the Shopify order-status page and clicks
   **Cancelar itens**.
2. Shopify displays only eligible, unshipped lines under the configured
   cancellation rules.
3. The customer chooses line quantities/reason, reviews the request, and
   submits it.
4. Shopify emails the customer a request confirmation. The order stays in its
   current state; no item is removed and no refund is issued yet.
5. Shopify emails staff and exposes the request through the **Customer
   request** filter and a banner on the order.
6. Staff makes a deliberate decision:

   - **Approve/resolve:** choose **Remove items**, verify quantities, refund
     amount, restock behavior, shipping/tax implications, and submit the
     standard Shopify refund flow.
   - **Decline:** choose **Manage request**, provide a customer-facing reason,
     and decline the request.
   - **Mark resolved:** use only when the request was handled elsewhere; this
     closes the request without changing the order or emailing the customer.

7. Shopify records the decision in the order timeline and sends the applicable
   customer notification.
8. Synarava's order summary eventually reflects Shopify's authoritative
   financial/fulfillment/refund state through the Customer Account API.

### Shopify configuration to verify

1. **Settings -> Customer accounts**

   - Customer accounts are the current passwordless version, not legacy.
   - Self-serve returns and cancellations are enabled.
   - Request type is **Return and cancel requests**, unless the written store
     policy deliberately says otherwise.
   - `account.shop.synarava.com` is the primary customer-account domain.

2. **Settings -> Policies -> Return and cancellation rules**

   - Choose and document the cancellation window. For the intended Portugal/EU
     flow, the recommended starting point is **Until item is fulfilled**.
   - Set the return window to at least 14 days and start it from delivery of the
     last item in the order for the EU market.
   - Define any final-sale products/collections in Shopify, not in a local
     eligibility list.
   - Check personalized jewellery explicitly: Shopify does not automatically
     exempt personalized products from cancellation.
   - Confirm return shipping and restocking-fee policy.

3. **Settings -> Notifications**

   - Review request-received, approved/resolved, declined, refund, and shipping
     notification content in European Portuguese.
   - Make ordinary store links point to `shop.synarava.com`.
   - Keep secure order/account URLs and tracking URLs Shopify-owned.

4. **Storefront policy and navigation**

   - Link the refund/cancellation policy to the branded customer-account URL.
   - Explain that cancellation is a request until approved.
   - Explain expected response time and what happens if fulfillment starts
     before staff reviews the request.

The EU settings above are an engineering/configuration baseline derived from
Shopify guidance, not legal advice. Have the final Portuguese/EU policy and any
personalized-goods exemptions reviewed by qualified counsel.

### Required application changes

1. Rename the headless profile link from a generic "Order details" concept to
   a clear localized action such as "Manage order in secure account". It should
   continue to use Shopify's `statusPageUrl`.
2. Add a visible cancellation/returns entry point to the storefront policy and
   profile orders section.
3. Decide the single canonical return UX after an end-to-end parity check:

   - **Recommended phase 1:** Shopify account is canonical for both returns and
     cancellations. Keep the headless order list as a summary and route order
     management to Shopify.
   - Remove or hide the existing `ReturnRequestPanel` only after confirming the
     native flow, historical requests, translations, and notifications. Do not
     leave two forms that appear to create different kinds of return.
   - A future custom cancellation UI is acceptable only if a current stable
     Customer Account API contract exposes the full eligibility and request
     workflow. Do not substitute the irreversible Admin API `orderCancel`
     mutation in a customer-facing route.

4. Add state refresh behavior after returning from Shopify so the headless
   profile does not show stale totals/statuses. Prefer `no-store` customer order
   reads or explicit revalidation; Shopify remains authoritative.
5. Extend operational observation for cancellation/refund outcomes without
   storing a second order. Before implementation, verify the exact current
   Admin webhook topics and scopes for cancellation, refund, fulfillment, and
   return lifecycle events. Reuse the existing HMAC verification,
   deduplication, receipt, and structured-log pattern used by `orders/paid`.

## Routing policy

| Destination | Owner | Must remain on |
| --- | --- | --- |
| Catalogue, product, collection, home, cart | Synarava Next.js | `shop.synarava.com` |
| Checkout and payment | Shopify | `checkout.shop.synarava.com` |
| Customer account, orders, cancel/return request | Shopify | `account.shop.synarava.com` |
| Shop tracking | Shopify Shop | Shopify-provided URL |
| Carrier tracking | Carrier | Shopify-provided carrier URL |

Every link change must be evaluated against this table. A branded Shopify
subdomain is expected and acceptable; a Shopify-hosted account page is not a
failure by itself.

## Delivery plan

### Phase 0 — Contain the broken path

- [ ] Hide Shopify's Buy again button (Shopify Admin — until BA matrix passes).
- [ ] Keep Cancel items enabled if policy and staff workflow are ready.
- [ ] Train staff that a cancellation request is not an automatic cancellation.
- [ ] Confirm notification recipients and Order permissions for the staff who
  will review customer requests.

### Phase 1 — Build the cart-permalink bridge

- [x] Implement and unit-test the pure permalink parser (`lib/shopify/cart-permalink.ts`).
- [x] Implement multi-line cart addition through the commerce boundary.
- [x] Add localized route, replay protection, rate limiting, and redirect
  (`app/[locale]/cart/[permalink]/route.ts`).
- [x] Add localized cart success/partial/error notices.
- [x] Add safe structured logs (`shopify.buy_again.*`).
- [x] Test against current Next.js redirect guidance before shipping.

### Phase 2 — Route the Online Store back to headless

- [ ] Audit the proposed redirect theme/code and exclusions.
- [x] Deploy the route bridge first (app on `main`).
- [ ] Preview the redirect behavior without publishing it.
- [ ] Test product, collection, home, cart permalink, checkout, challenge, and
  locale paths.
- [ ] Publish only after checkout and account paths remain intact.
- [ ] Re-enable Buy again.

### Phase 3 — Consolidate order management

- [ ] Verify self-serve cancellation and return rules in Shopify.
- [x] Update profile copy: “Manage order in secure account” + hint (Shopify canonical).
- [x] Hide headless `ReturnRequestPanel` (Shopify account is phase-1 return UX).
- [x] Profile orders use `force-dynamic` / no-store so totals refresh after Shopify.
- [x] Ops webhooks: `ORDERS_CANCELLED`, `REFUNDS_CREATE`, `RETURNS_REQUEST`
  (HMAC + dedupe + structured log; registered on reconcile).
- [ ] End-to-end parity test of native return vs retired custom panel in production.

### Phase 4 — Production readiness

- [ ] Complete the manual matrix below in Shopify test mode where supported.
- [ ] Run controlled low-value live checks for behaviors unavailable in test
  mode.
- [ ] Update `docs/payment-checkout-test-matrix.md` with evidence and defects.
- [x] Add an operations runbook: `docs/post-purchase-ops-runbook.md`.

## Acceptance test matrix

### Buy again

| ID | Scenario | Pass criteria |
| --- | --- | --- |
| BA-001 | One available variant | One requested unit appears in the Synarava cart; locale is preserved. |
| BA-002 | Multiple variants and quantities | Every requested line and quantity is imported exactly once. |
| BA-003 | Existing cart | Existing lines remain and requested quantities merge once. |
| BA-004 | Refresh/back/forward | The same landing URL does not add quantities twice during the replay window. |
| BA-005 | Duplicate IDs in URL | Duplicates are normalized deterministically within configured limits. |
| BA-006 | Invalid ID/quantity/syntax | Nothing unsafe is executed; customer sees a localized recovery message. |
| BA-007 | Deleted/archived/unpublished variant | Item is skipped and reported; hidden merchandise is not added. |
| BA-008 | Insufficient inventory | Shopify's authoritative quantity/warning is shown without false success. |
| BA-009 | Shopify unavailable | Existing cart survives; retry is possible; structured failure is observable. |
| BA-010 | Signed-in checkout after reorder | Checkout opens on the branded checkout host without redundant login when Shopify can honor the session. |
| BA-011 | Mobile Safari/Chrome | Link, redirect, notice, cart, and checkout work without layout or cookie failures. |
| BA-012 | PT/EN locale paths | Correct locale is retained; unsupported locale falls back safely. |

### Cancel items

| ID | Scenario | Pass criteria |
| --- | --- | --- |
| CA-001 | Fully unfulfilled order | Eligible lines can be requested; order remains unchanged pending staff action. |
| CA-002 | Partial-line cancellation | Requested quantity is clear; unrequested quantity remains untouched. |
| CA-003 | Mixed shipped/unshipped order | Shopify offers cancel for unshipped lines and return for delivered/fulfilled lines as eligible. |
| CA-004 | Outside cancellation window | Cancel action is absent/disabled with policy-consistent behavior. |
| CA-005 | Final-sale/personalized item | Shopify eligibility matches the configured and legally reviewed policy. |
| CA-006 | Staff approval | Correct items are removed/refunded/restocked; timeline and customer email are correct. |
| CA-007 | Staff decline | No order mutation occurs; reason is emailed and timeline records the decision. |
| CA-008 | Duplicate submission/reload | No duplicate refund or duplicate operational action occurs. |
| CA-009 | Fulfillment race | Staff sees current fulfillment state and cannot refund/remove the wrong quantity silently. |
| CA-010 | Headless profile refresh | Totals, financial state, and fulfillment state converge to Shopify after resolution. |

### Regression paths

- Order-confirmation email ordinary store links open `shop.synarava.com`.
- `Visualizar a sua encomenda` opens the secure Shopify order-status page.
- Product/store links from Shopify account return to the headless storefront.
- Checkout, Shop tracking, carrier tracking, and authentication links are not
  intercepted by the storefront redirect.
- Paid webhook HMAC, deduplication, and observability continue to pass.
- Refund/cancellation work never creates a local duplicate Order.

## Rollout and rollback

Roll out in this order:

1. Hide Buy again.
2. Deploy parser, cart bridge, notices, tests, and telemetry.
3. Verify production URL behavior with the Online Store redirect still
   unpublished.
4. Publish the reviewed Online Store redirect.
5. Re-enable Buy again for a small controlled test, then all customers.

Rollback is the reverse: hide Buy again first, unpublish/disable the Online
Store redirect, and leave Shopify checkout/account domains untouched. The
existing `/{locale}/cart` and checkout path must continue to work independently
of the permalink bridge.

## Definition of done

This work is complete only when:

- every customer-facing URL follows the routing policy;
- Buy again imports Shopify variants into the Synarava cart exactly once and
  handles partial availability visibly;
- Cancel items is documented, policy-controlled, staffed, and verified through
  both approve and decline paths;
- one canonical return-request experience is selected;
- application logs and Shopify Admin together explain every material outcome;
- no local parallel order/cancellation/refund model exists;
- the payment test log contains evidence from a fresh order after the final
  Shopify configuration change.

## Official references

- [Shopify cart permalink contract](https://shopify.dev/docs/apps/build/checkout/create-cart-permalinks)
- [Customer-account customization, Buy again, and cancellations](https://help.shopify.com/en/manual/customers/customer-accounts/upgrade/customization-options)
- [Set up self-serve returns and cancellations](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns/self-serve-returns/setup)
- [Manage cancellation and return requests](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns/self-serve-returns/management)
- [Configure return and cancellation rules](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns/return-rules)
- [Redirect headless storefront traffic](https://shopify.dev/docs/storefronts/headless/hydrogen/migrate/redirect-traffic)
- [Shopify URL redirect limitations](https://help.shopify.com/en/manual/online-store/menus-and-links/url-redirect)
