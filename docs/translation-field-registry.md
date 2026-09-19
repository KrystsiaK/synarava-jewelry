# Translation field registry

Source of truth: `lib/i18n/admin-field-registry.ts`. This doc is a human-readable
mirror for review — if it disagrees with the code, the code wins; update this
file in the same change.

Legend — **Mode**: `shared` (one value for EN/PT) or `localized` (independent
EN/PT). **Required**: `always`, `when-published`, or `optional`. **Shopify
target**: `native` (a real Shopify field), `metafield` (translatable
metafield on the native owner), `metaobject` (translatable `$app:` metaobject
for Synarava-structured content with no native Shopify equivalent), or `—`
(shared fields are never owned by the translation platform).

## Product

| Key | Mode | Required | Shopify target |
|---|---|---|---|
| title | localized | always | native `PRODUCT.title` |
| shortDescription | localized | always | metafield `synarava.short_description` |
| description | localized | always | native `PRODUCT.body_html` |
| materialLine | localized | optional | metafield `synarava.material_line` |
| symbolismLabel/Title/Body/Body2 | localized | optional | metafield `synarava.symbolism_*` |
| details (materials/process/lookbook stories) | localized | optional | metaobject `product_detail_copy.details` |
| seoTitle/seoDescription | localized | when-published | native `PRODUCT.meta_title`/`meta_description` |
| optionName / optionValueLabel | localized | when-published | native `PRODUCT_OPTION` / `PRODUCT_OPTION_VALUE` |
| mediaAlt | localized | optional | native `MEDIA_IMAGE.alt` |
| mediaCaption | localized | optional | metaobject `product_detail_copy.media_caption` |
| sku, price, compareAt, currency, status, visibility, category, collections, tags, media, variants | shared | — | — |

## Collection

| Key | Mode | Required | Shopify target |
|---|---|---|---|
| name | localized | always | native `COLLECTION.title` |
| subtitle | localized | optional | metafield `synarava.subtitle` |
| description | localized | when-published | native `COLLECTION.body_html` |
| manifesto | localized | optional | metafield `synarava.manifesto` |
| symbolismLabel/Title/Body/Body2 | localized | optional | metafield `synarava.symbolism_*` |
| searchSummary | localized | optional | metafield `synarava.search_summary` |
| seoTitle/seoDescription | localized | when-published | native `COLLECTION.meta_title`/`meta_description` |
| heroImageAlt | localized | optional | native `COLLECTION_IMAGE.alt` |
| sectionTitle/Eyebrow/Body (per `CollectionSection`) | localized | optional | metaobject `collection_section_copy.*` |
| code, slug, status, visibility, membership, images, navOrdering | shared | — | — |

## Page / Home / About / Legal

One registry (`PAGE_FIELD_REGISTRY`) covers every `PageTemplate`; a given
page only uses the subset of keys its template renders (keys mirror
`PageContent` in `lib/content/catalog.ts`).

| Key | Mode | Required | Shopify target |
|---|---|---|---|
| title | localized | always | native `PAGE.title` |
| body | localized | when-published | native `PAGE.body_html` |
| excerpt, eyebrow, ctaLabel, quote, secondaryTitle/Body, department/archive/material/manifesto/final-cta section copy, materialLexicon, legalIntro, legalLastUpdated, legalSections | localized | optional (see code for exceptions) | metaobject `page_section_copy.*` |
| seoTitle/seoDescription | localized | when-published | native `PAGE.meta_title`/`meta_description` |
| slug, template, status, visibility, heroImage, ctaHref, finalCtaHref, finalContactEmail, section enabled flags | shared | — | — |

Flat legal policy pages that match a Shopify `SHOP_POLICY` (Privacy, Terms)
sync `body`/`title` there instead of `PAGE` — resolved per-page in Task 16,
not in the registry itself (the registry only fixes the *field*, not which
native resource a given page instance binds to).

## Storefront copy

Derived programmatically from `STOREFRONT_COPY_KEYS`
(`lib/content/storefront-copy-fields.ts`) so the two lists cannot drift.
`nav.*` keys target native `LINK`; everything else (footer, FAQ/Care/
Shipping/Returns page copy) has no native Shopify resource and targets
metaobject `storefront_copy.<key>`.

## Taxonomy (merchant-owned labels only)

Shopify's Standard Product Taxonomy (`shopifyCategoryName`) is Shopify's own
source of truth and is out of scope.

| Key | Mode | Required | Shopify target |
|---|---|---|---|
| categoryName | localized | always | metaobject `taxonomy_label.category_name` |
| categoryDescription | localized | optional | metaobject `taxonomy_label.category_description` |
| tagName | localized | always | metaobject `taxonomy_label.tag_name` |
| characteristicLabel | localized | always | metaobject `taxonomy_label.characteristic_label` |
| categorySlug, shopifyTaxonomyId, characteristicKey | shared | — | — |

## Explicitly out of scope (not in the registry)

- Admin UI chrome, logs, error messages, SKUs, internal technical names.
- Site videos (`lib/site-videos.ts`): four ambient background video file
  slots with no title/caption/alt text today — nothing to localize. If
  buyer-facing video copy is added later, register it then.
- URL/slug/handle: tracked as `shared` for v1 per `tasks/plan.md`; localized
  slugs are an explicit scope addition agreed 2026-09-19 and land in a
  dedicated SEO/redirect task (see Task 23 in `tasks/todo.md`), not by
  changing the `shared` fields above.
