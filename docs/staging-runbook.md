# Staging runbook

Staging URL: `https://synarava-shop-app-staging.up.railway.app`.

## Git flow

- Day-to-day work lands on `staging` first (integration + Railway staging deploy).
- Promote to production by opening a PR from `staging` into `main`.
- **Do not squash** when merging that PR — use a merge commit (or rebase+merge
  that preserves a tip `main` can fast-forward). Squash rewrites history and
  makes `sync-main-to-staging` fail with `Not possible to fast-forward`.
- If `main` moves ahead (hotfix), `.github/workflows/sync-main-to-staging.yml`
  fast-forwards `staging` to `main` so the branches do not diverge.
- If the branches already diverged (usually after a squash), reset `staging` to
  `main` once the trees match: `git checkout staging && git reset --hard origin/main && git push --force-with-lease origin staging`.

Railway injects `RAILWAY_ENVIRONMENT_NAME`. The application uses that value to
keep staging out of search indexes and to disable GTM/Meta destinations even if
their IDs were copied from production. `NODE_ENV` is not used for this decision
because both Railway environments run optimized production builds.

## Railway environment checklist

For the `staging` environment, verify in the Railway UI:

- `APP_URL` and public site URL values use the staging HTTPS origin.
- `DATABASE_URL` is a reference to the Postgres service in the **staging**
  environment, not a pasted production connection string.
- S3/bucket variables point to a staging bucket or an explicitly isolated
  staging prefix.
- `NEXT_PUBLIC_PRIVACY_EMAIL` is `care@synarava.com`.
- Shopify Storefront/Admin/Customer Account credentials belong to the staging
  Shopify store.
- Session and webhook secrets are independently generated for staging.
- `ENABLE_NON_PRODUCTION_ANALYTICS` is absent unless analytics is being tested
  deliberately.

Railway variables are scoped per environment. Duplicating an environment copies
configuration, so every external service reference still needs this review.

## Shopify staging checklist

- Customer Account callback:
  `https://synarava-shop-app-staging.up.railway.app/api/auth/shopify/callback`
- Customer Account logout:
  `https://synarava-shop-app-staging.up.railway.app/api/auth/shopify/logout`
- JavaScript origin:
  `https://synarava-shop-app-staging.up.railway.app`
- Publish at least one non-production test product to the Headless sales
  channel before testing product, cart, checkout, order, or return flows.
- Confirm Admin API scopes and webhook subscriptions against the staging store;
  never solve a missing native Shopify capability with a parallel local model.

## Smoke test after every deploy

1. `/api/health` returns `200`, `ok: true`, and the expected Git revision.
2. `/en` and `/pt` render without console errors.
3. `/robots.txt` contains `Disallow: /` and HTML responses contain
   `X-Robots-Tag: noindex, nofollow, noarchive`.
4. Page metadata contains `noindex, nofollow`.
5. No request is made to Google Tag Manager or Meta after consent unless the
   temporary non-production analytics override is enabled.
6. Footer, service pages, terms, offer, privacy, and home contact CTA show
   `care@synarava.com`, never the retired Gmail address.
7. `Enter the collection` navigates to `/en/shop` or `/pt/shop`.
8. `/admin` redirects to the admin login and valid credentials open the admin.
9. Shopify customer login returns to the requested localized profile page.
10. With a published test product, add to cart and continue to Shopify checkout
    without completing a real payment.

## Production guard

The Railway environment that serves the public shop must be named exactly
`production`. Production keeps the public robots/sitemap behavior and optional
analytics remains consent-gated as documented in `privacy-operations.md`.
