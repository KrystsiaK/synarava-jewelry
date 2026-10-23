# Shopify Admin GraphQL fixtures (ground truth)

Live, **redacted** snapshots from the staging partner development shop.

- **API version:** `2026-07`
- **Auth used for capture:** OAuth `client_credentials` (read-only scopes)
- **Audit:** [`docs/audits/2026-10-shopify-api-ground-truth.md`](../../../docs/audits/2026-10-shopify-api-ground-truth.md)

Do not put access tokens or client secrets in this directory. Re-capture with a fresh token when shapes change.

## Part 2 fixtures (2026-10 ground truth)

Live RO queries (no mutations):

- `collections.json` — collections with products membership, seo, metafields, sources
- `products-full-window.json` + `products-full-window.query.graphql` — same `PRODUCT_FIELDS` as `lib/shopify/product-sync.ts`
- `inventory-levels-sample.json` — enrichment path from `lib/shopify/inventory-levels.ts`
- `translatable-resources.json` — PRODUCT / COLLECTION / PAGE + `translations(locale:)` (outdated returned; digest is on `translatableContent` only)
- `shop-locales-and-markets.json` — `shopLocales` OK; `markets` ACCESS_DENIED without `read_markets`
- `_capture-cost-summary.json` — `extensions.cost` + request counts (`mutation_count: 0`)

Docs-derived (not live):

- `webhook-products-update.docs.json`
- `webhook-products-delete.docs.json`
- `webhook-inventory-levels-update.docs.json`

