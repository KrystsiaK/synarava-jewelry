# Shopify Admin API ground truth (2026-10)

**Mode:** read-only live capture against the staging partner development shop  
**Captured:** 2026-10-23 (part 1 + part 2)  
**Admin GraphQL API version:** `2026-07` (repo default: `lib/shopify/admin.ts` → `SHOPIFY_ADMIN_API_VERSION ?? "2026-07"`)  
**Auth:** OAuth `client_credentials` via `POST https://{SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token` (fresh process env; no token cache)  
**Shop hostname:** partner-dev label `synarava-shop-staging` + `.myshopify.com` (length 35; exact host held in env `SHOPIFY_STORE_DOMAIN`, not duplicated here for secret-scan hygiene)  
**Plan:** Basic App Development (`partnerDevelopment: true`)  
**Fixtures:** [`tests/fixtures/shopify/`](../../tests/fixtures/shopify/)

No access tokens, client secrets, or raw catalog copy are committed. Product IDs/handles/titles/URLs and CDN paths are redacted in fixtures.

**Part 2 mutation count: 0** (queries only; no GraphQL mutations, no REST writes, no webhook creation). Part 1’s historical `write-denied-productUpdate.json` remains as a denial artifact from an earlier capture — it was **not** repeated in part 2.

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
| `read_markets` | **not granted** → root `markets` query returns `ACCESS_DENIED` |

---

## What was captured

### Part 1

| Fixture | Source | Notes |
| --- | --- | --- |
| `_meta-shop-probe.json` | `shop { plan }` | Partner-dev confirmation |
| `products-first-3.json` | `products(first: 3, sortKey: ID)` | **2** products on shop (shape under redaction) |
| `products-first-3-shape.json` | derived | Type-only tree of first product node |
| `write-denied-productUpdate.json` | `productUpdate` mutation | Harmless write **denied** (part 1 only; not repeated) |
| `metaobject-definitions.json` | `metaobjectDefinitions(first: 25)` | 1 definition |
| `metaobjects-sample.json` | `metaobjects(type: …, first: 10)` | 1 entry for first definition type |
| `shop-locales.json` | `shopLocales` | Locale publication list |
| `_capture-summary.json` | capture metadata | Counts + denial summary |

### Part 2

| Fixture | Source | Notes |
| --- | --- | --- |
| `collections.json` | `collections(…)` + `products`, `seo`, `metafields`, `sources` | 1 collection; membership + SEO present; metafields empty |
| `products-full-window.json` | **same** `SynaravaCommerceStoreProducts` / `PRODUCT_FIELDS` as `lib/shopify/product-sync.ts` | publications, collection sources, media (`originalSource`), variants, metafields |
| `products-full-window.query.graphql` | exact query text | parity artifact |
| `inventory-levels-sample.json` | `SynaravaInventoryLevels` (same as `lib/shopify/inventory-levels.ts`) | enrichment path; quantity names preserved |
| `translatable-resources.json` | `translatableResources` for `PRODUCT` / `COLLECTION` / `PAGE` + `translations(locale:)` | digest on `translatableContent`; `outdated` selected on `Translation`; digest on `Translation` is `undefinedField` |
| `shop-locales-and-markets.json` | `shopLocales` + attempted `markets` | locales OK; markets `ACCESS_DENIED` without `read_markets` |
| `_capture-cost-summary.json` | `extensions.cost` | catalog + translation request counts; `mutation_count: 0` |
| `webhook-*.docs.json` | **docs-derived** (not live) | Official Admin REST webhook examples for `products/update`, `products/delete`, `inventory_levels/update` |

### Product node shape (full window keys observed)

`id`, `title`, `handle`, `descriptionHtml`, `vendor`, `productType`, `tags`, `status`, `updatedAt`, `totalInventory`, `category`, `seo`, `media` (incl. `originalSource` on `MediaImage`), `options`, `collections` (+ `sources`), `resourcePublicationsV2`, `featuredMedia`, `variants` (+ `inventoryItem`), `metafields`.

Inventory levels are **not** nested inside `PRODUCT_FIELDS`; `fetchShopifyProduct` enriches via a separate `inventoryItem { inventoryLevels }` query. `listShopifyProductWindowsForCommerceStore` intentionally skips that enrichment.

### Translations (2026-07)

- Exact field used by code: `translations(locale:)` on `TranslatableResource` — returns `key`, `value`, `updatedAt`, `outdated`.
- `digest` lives on `translatableContent`, **not** on `Translation` (`Field 'digest' doesn't exist on type 'Translation'`).
- Staging shop has only primary locale `en`; `translations(locale: "en")` returned `[]` for PRODUCT / COLLECTION / PAGE (source copy is in `translatableContent`). No live non-primary translation rows to sample `outdated: true`.

### Markets

Root `markets { … }` requires `read_markets`. This RO app does not have it. Repo code uses `shopLocales` (with `read_locales` / `read_markets_home`) and does **not** query the `markets` connection for sync.

### Cost / request count (part 2, approximate full catalog on this small shop)

| Sweep | Requests | Σ `actualQueryCost` | Σ `requestedQueryCost` |
| --- | --- | --- | --- |
| Catalog (products full window + collections) | 2 | 21 | 1096 |
| Translations (PRODUCT + COLLECTION + PAGE, first page) | 3 | 10 | 60 |
| **Mutations** | **0** | — | — |

See `_capture-cost-summary.json` for per-request throttle snapshots.

### Write denial (part 1 only — not repeated)

Attempted `productUpdate` with a probe tag on the first product id.

- HTTP **200** (GraphQL transport OK)
- GraphQL error code: `ACCESS_DENIED`
- Message: requires `write_products`
- **No mutation applied** (`product_mutated: false`)

### Metaobjects (part 1)

Scopes `read_metaobjects` / `read_metaobject_definitions` were granted. Live query returned one definition and one sample metaobject (redacted in fixtures).

---

## Mismatch table

Status legend: `ok` = code expectation matches live/docs shape · `missing` = Shopify does not return what code needs (or scope blocks it) · `ignored` = Shopify returns it but code does not use it · `wrong` = code assumption conflicts with API.

| Area | Code expects | Shopify returns | Status | File:line |
| --- | --- | --- | --- | --- |
| Admin API version default | `2026-07` | Live capture on `2026-07` | `ok` | `lib/shopify/admin.ts` (default `SHOPIFY_ADMIN_API_VERSION`) |
| Product commerce window fields | `PRODUCT_FIELDS` (pubs, collections+sources, media, variants, metafields, seo, category) | Same keys present on live nodes | `ok` | `lib/shopify/product-sync.ts:184-200`, `:553-576` |
| `resourcePublicationsV2` | `isPublished`, `publishDate`, `publication { id name }` | Present; some products empty `nodes`, others populated | `ok` | `lib/shopify/product-sync.ts:194`, `:349` |
| Collection sources on product | `sources { __typename id title … CollectionConditionsSource.targetType }` | Live `CollectionConditionsSource` + `targetType: PRODUCTS` | `ok` | `lib/shopify/product-sync.ts:166-171`, `:190-192` |
| Media `originalSource` (not `filename`) | Derive filename from `originalSource.url` / image URL | `MediaImage.originalSource { url }` present; no `filename` field | `ok` | `lib/shopify/staged-product-media.ts:7-15`, `:30-46` |
| Inventory levels nested on product list | Commerce list does **not** fetch levels | Levels only via separate `inventoryItem` query | `ok` (intentional) | `lib/shopify/product-sync.ts:548-551`, `:541-544`; `lib/shopify/inventory-levels.ts:31-64` |
| Inventory quantity names | `available` (+ committed/on_hand/…) | Same names returned | `ok` | `lib/shopify/inventory-levels.ts:19-28`, `:46` |
| Collection commerce window | `id title handle descriptionHtml seo` only | API also has `products`, `metafields`, `sources`, `productsCount` | `ignored` | `lib/shopify/collection-commerce-fetch.ts:31-38`; `lib/shopify/collection-commerce-projection.ts:134-150` |
| Collection presence pull | Includes `sources` + seo + descriptionHtml | Matches | `ok` | `lib/shopify/collection-presence-server.ts:208-216` |
| `shopLocales` | `locale name primary published` | Returned | `ok` | `lib/shopify/admin.ts:212-218` |
| Locale scope alternate | `read_locales` **or** `read_markets_home` | RO app has `read_locales`; `read_markets_home` not granted (unused) | `ok` | `lib/shopify/admin.ts:176`, `:242-258` |
| Published markets (`markets` query) | Ground-truth deliverable / potential ops visibility | `ACCESS_DENIED` — needs `read_markets` | `missing` | (no repo caller today; capture in `shop-locales-and-markets.json`) |
| `translatableContent.digest` | Required for register | Returned on content entries | `ok` | `lib/shopify/translations.ts:5-10`, `:201`, `:225` |
| `translations(locale:)` selection | `key value updatedAt outdated` | Schema accepts; live arrays empty on primary-only shop | `ok` | `lib/shopify/translations.ts:12`, `:226`, `:323`, `:345` |
| `Translation.digest` | Not selected by code | Field **does not exist** (`undefinedField`) | `ok` | probe in `translatable-resources.json`; contrast `translations.ts:226` |
| Non-primary translations / `outdated: true` sample | `outdated` boolean used in pull decisions | No alternate locales on staging shop → cannot observe live `outdated` | `missing` (data) | `lib/shopify/translations.ts:164`; `lib/i18n/sync-comparison.ts:11-13`, `:189`; `lib/shopify/translation-reconciliation.ts:89` |
| Sync comparison remote metadata | Optional `updatedAt` / `outdated` | Matches Translation fields when present | `ok` | `lib/i18n/sync-comparison.ts:11-13`, `:165-189` |
| Primary-locale “translations” | Callers may ask `translations(locale: primary)` | Returns `[]`; source is `translatableContent` | `ok` | `lib/shopify/source-content.ts:19` (maps content → pseudo translations with `outdated: null`) |
| Commerce store fetch | Products + collections windows via list queries | Aligns with fixtures | `ok` | `lib/commerce-store/fetch-shopify-store.ts:16-30` |
| Webhook `products/update` | Uses `payload.id` only | Docs payload also has variants, media, tags, `variant_gids`, etc. | `ignored` | `app/api/shopify/webhooks/products/route.ts:25-30`, `:62`; fixture `webhook-products-update.docs.json` |
| Webhook `products/delete` | Uses `payload.id` | Docs payload `{ id }` only | `ok` | `app/api/shopify/webhooks/products/route.ts:46-52`; fixture `webhook-products-delete.docs.json` |
| Webhook `inventory_levels/update` | Uses `inventory_item_id`, then GraphQL re-fetch | Docs also return `location_id`, `available`, `admin_graphql_api_id`, `updated_at` | `ignored` | `app/api/shopify/webhooks/products/route.ts:25-27`, `:44-45`; fixture `webhook-inventory-levels-update.docs.json` |
| Webhook live trigger | Would prefer live samples | RO cannot create webhooks / mutate inventory | `missing` (live) | docs-derived fixtures only |

### Mismatch counts (part 2 table)

| Status | Count |
| --- | --- |
| `ok` | 18 |
| `ignored` | 3 |
| `missing` | 3 |
| `wrong` | 0 |

---

## Repo alignment notes

- Default Admin API version in code matches this capture (`2026-07`).
- Part 2 closes the part-1 gap: full `PRODUCT_FIELDS` window + inventory enrichment sample + collections membership/SEO + translations index + cost summary.
- Do **not** treat part 1’s `productUpdate` denial as a recipe to re-run under RO credentials.

---

## Safety

- Production Synarava storefront domains were not used.
- Token material lived only in memory / mode-600 temp files deleted after capture.
- Fixtures scanned for `shpat_` / `shpss_` / `access_token` / raw `*.myshopify.com` hostnames before commit.
- Part 2: **mutation_count = 0**.
