# Shopify Admin API ground truth (2026-10)

**Mode:** read-only live capture against the staging partner development shop  
**Captured:** 2026-10-23  
**Admin GraphQL API version:** `2026-07` (repo default: `lib/shopify/admin.ts` → `SHOPIFY_ADMIN_API_VERSION ?? "2026-07"`)  
**Auth:** OAuth `client_credentials` via `POST https://{SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token` (fresh process env; no token cache)  
**Shop hostname:** partner-dev label `synarava-shop-staging` + `.myshopify.com` (length 35; exact host held in env `SHOPIFY_STORE_DOMAIN`, not duplicated here for secret-scan hygiene)  
**Plan:** Basic App Development (`partnerDevelopment: true`)  
**Fixtures:** [`tests/fixtures/shopify/`](../../tests/fixtures/shopify/)

No access tokens, client secrets, or raw catalog copy are committed. Product IDs/handles/titles/URLs and CDN paths are redacted in fixtures.

---

## Auth result

| Check | Result |
| --- | --- |
| `SHOPIFY_CLIENT_ID` | SET (length 32) |
| `SHOPIFY_CLIENT_SECRET` | SET (length 38) |
| `SHOPIFY_STORE_DOMAIN` | SET (hostname length 35; ends with `.myshopify.com`) |
| Token HTTP status | **200** |
| Grant | `client_credentials` |
| Granted scopes | `read_products`, `read_inventory`, `read_locales`, `read_translations`, `read_publications`, `read_metaobjects`, `read_metaobject_definitions` |
| Write scopes | **none** (intentional for this RO app) |

---

## What was captured

| Fixture | Source | Notes |
| --- | --- | --- |
| `_meta-shop-probe.json` | `shop { plan }` | Partner-dev confirmation |
| `products-first-3.json` | `products(first: 3, sortKey: ID)` | **2** products on shop (shape under redaction) |
| `products-first-3-shape.json` | derived | Type-only tree of first product node |
| `write-denied-productUpdate.json` | `productUpdate` mutation | Harmless write **denied** |
| `metaobject-definitions.json` | `metaobjectDefinitions(first: 25)` | 1 definition |
| `metaobjects-sample.json` | `metaobjects(type: …, first: 10)` | 1 entry for first definition type |
| `shop-locales.json` | `shopLocales` | Locale publication list |
| `_capture-summary.json` | capture metadata | Counts + denial summary |

### Product node shape (keys observed)

`id`, `title`, `handle`, `status`, `vendor`, `productType`, `tags`, `updatedAt`, `totalInventory`, `descriptionHtml`, `seo`, `options`, `featuredMedia`, `media`, `variants` (with `inventoryItem`), `metafields`, `collections`.

### Write denial (required)

Attempted `productUpdate` with a probe tag on the first product id.

- HTTP **200** (GraphQL transport OK)
- GraphQL error code: `ACCESS_DENIED`
- Message: requires `write_products` (and user permission to update products)
- `data.productUpdate`: `null`
- **No mutation applied** (`product_mutated: false`)

This documents that the RO client credentials cannot mutate catalog data even when the Admin GraphQL endpoint accepts the HTTP request.

### Metaobjects

Scopes `read_metaobjects` / `read_metaobject_definitions` were granted. Live query returned one definition and one sample metaobject (redacted in fixtures).

---

## Repo alignment notes

- Default Admin API version in code matches this capture (`2026-07`).
- Commerce compare paths in `lib/shopify/product-sync.ts` request a richer window (publications, collection sources, deeper media). This ground-truth set intentionally starts with a compact product shape plus metaobjects/locales/denial; expand fixtures later if compare-window parity is needed.
- Inventory levels are **not** nested on the product query here; production enrichment uses a separate `inventoryItem { inventoryLevels }` path when `read_inventory` is used.

---

## Safety

- Production Synarava storefront domains were not used.
- Token material lived only in a mode-600 temp file deleted after capture.
- Fixtures scanned for `shpat_` / `shpss_` / `access_token` / raw `*.myshopify.com` hostnames before commit.
