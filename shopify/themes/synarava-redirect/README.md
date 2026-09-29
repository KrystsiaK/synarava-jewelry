# Synarava Redirect Theme

Versioned Online Store theme that sends Shopify-hosted catalogue / cart traffic
to the headless storefront at **`shop.synarava.com`**, while preserving
checkout, bot protection, and customer-account surfaces on Shopify.

Fork of [`Shopify/hydrogen-redirect-theme`](https://github.com/Shopify/hydrogen-redirect-theme)
(upstream SHA in `UPSTREAM_SHA.txt`) with Synarava-specific Buy again and
catalogue fixes.

## Why this fork exists

Shopify **Buy again** links look like:

```text
https://checkout.shop.synarava.com/pt/cart/66048797442397:1?...&country=PT
```

Before any theme runs, Shopify rewrites that to:

```text
/pt/cart?cart_link_id=...&country=PT
```

and materializes the lines on the Online Store cart. The stock Hydrogen redirect
theme then sends browsers to:

```text
https://shop.synarava.com/pt/cart?cart_link_id=...
```

which **never hits** Synarava’s `/{locale}/cart/[permalink]` bridge, so nothing
is added to the headless cart.

This theme detects `cart_link_id` + a non-empty Liquid `cart`, rebuilds
`<variant_id>:<quantity>,…`, and redirects to:

```text
https://shop.synarava.com/pt/cart/66048797442397:1?country=PT
```

Replay protection and notices stay in the Next.js bridge.

Also maps `/[locale]/collections/all` → `/[locale]/shop` (and `/collections/all` → `/shop`).

## Hostname

Theme setting **Storefront → Hostname**: `shop.synarava.com` (no protocol).

Online Store primary domain remains `checkout.shop.synarava.com`.

## Build ZIP

From the repo root:

```bash
node scripts/pack-synarava-redirect-theme.mjs
```

Output: `shopify/themes/synarava-redirect/dist/synarava-redirect-theme.zip`

## Upload / update (draft only until validated)

1. Shopify Admin → **Online Store → Themes**.
2. **Add theme → Upload zip file** → choose `synarava-redirect-theme.zip`.
3. Open the new **unpublished** theme → **Customize**.
4. **Theme settings → Storefront**:
   - Hostname: `shop.synarava.com`
   - Custom redirects (defaults ship in the ZIP):

     ```text
     /collections/all > /shop
     /en/collections/all > /en/shop
     /pt/collections/all > /pt/shop
     /ru/collections/all > /ru/shop
     ```

   - Integrate with customer accounts: **off** (unless intentionally wiring SSO hints).
5. **Preview** the draft theme (do **not** publish yet).
6. Run the [production validation matrix](#production-validation-matrix) against the preview / temporary publish window.
7. Publish only after an explicit go-ahead — keep Buy again hidden until BA checks pass.

To update later: upload a new ZIP as another theme, preview, then publish and
remove or rename the previous Synarava Redirect Theme.

## Rollback to Horizon

1. Shopify Admin → **Online Store → Themes**.
2. Find the previous **Horizon** (or prior published) theme.
3. **Actions → Publish**.
4. Hide **Buy again** again if it was re-enabled during the test window
   (**Settings → Checkout → Configurations → Customize → Settings → Buy again button**).
5. Leave the Synarava Redirect Theme in the library as an unpublished draft for
   the next attempt.

## Paths that must NOT redirect away

| Path / surface | Owner |
| --- | --- |
| `/challenge`, `/checkpoint`, `/throttle/queue` | Shopify bot protection |
| Checkout / payment | `checkout.shop.synarava.com` |
| Customer account / order status | `account.shop.synarava.com` |

The theme skips redirect for design mode and for path prefixes matching
checkout, orders, account, payments, wallets, and services, in addition to the
official challenge/checkpoint/throttle exclusions.

## Buy again rewrite rules

Trigger **only** when all of the following hold:

1. Pathname ends with `/cart`
2. Query contains `cart_link_id`
3. Liquid `cart.items` is non-empty (permalink built server-side)

Then:

- Target: `https://shop.synarava.com{localeRoot}/cart/{variant}:{qty},…`
- Keep query allowlist: `country`, `discount` (plus discount cookie → `discount`)
- Drop: `cart_link_id`, `sso`, other Buy again noise
- Ordinary `/cart` visits without `cart_link_id` still redirect to headless `/cart` (no import)

## Production validation matrix

Run after the draft is previewable (or temporarily published with Buy again
still limited to a test customer if needed). Record evidence in
[`docs/payment-checkout-test-matrix.md`](../../../docs/payment-checkout-test-matrix.md).

| ID | Check | Pass |
| --- | --- | --- |
| RT-BA-01 | Buy again / Comprar novamente adds qty exactly once into headless cart | |
| RT-BA-02 | Existing headless cart lines are preserved / merged | |
| RT-BA-03 | Refresh / re-open same Buy again link does not double-add (replay) | |
| RT-BA-04 | Cart notice appears, then gone after reload | |
| RT-BA-05 | PT and EN locale prefixes | |
| RT-CAT-01 | Product / home / collection links land on `shop.synarava.com` | |
| RT-CAT-02 | `/pt/collections/all` → `/pt/shop` (and EN / bare `/collections/all`) | |
| RT-SYS-01 | Checkout stays on Shopify checkout | |
| RT-SYS-02 | Account / order status stay on account domain | |
| RT-SYS-03 | Challenge / checkpoint still render on Online Store | |
| RT-QS-01 | `country` (and other allowlisted params) preserved on Buy again | |

## Related docs

- [`SHOPIFY_POST_PURCHASE_FLOWS.md`](../../../SHOPIFY_POST_PURCHASE_FLOWS.md)
- [`docs/post-purchase-ops-runbook.md`](../../../docs/post-purchase-ops-runbook.md)
- [`docs/payment-checkout-test-matrix.md`](../../../docs/payment-checkout-test-matrix.md)
- Official Shopify redirect guide: <https://shopify.dev/docs/storefronts/headless/hydrogen/migrate/redirect-traffic>
