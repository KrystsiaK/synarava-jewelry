# Translation field registry

Source of truth: `lib/i18n/admin-field-registry.ts`. This doc is a human-readable
mirror for review — if it disagrees with the code, the code wins; update this
file in the same change.

Legend — **Mode**: `shared` (one value across every locale) or `localized`
(an independent value per registered locale). **Required**: `always`,
`when-published`, or `optional`. **Shopify
target**: `native` (a real Shopify field), `metafield` (translatable
metafield on the native owner), `metaobject` (translatable `$app:` metaobject
for Synarava-structured content with no native Shopify equivalent), or `—`
(shared fields are never owned by the translation platform).

## Product

| Key | Mode | Required | Shopify target |
|---|---|---|---|
| title | localized | always | native `PRODUCT.title` |
| localizedHandle | localized | optional | native `PRODUCT.handle` (Task 23) |
| shortDescription | localized | always | metaobject `product_detail_copy.short_description` |
| description | localized | always | native `PRODUCT.body_html` |
| materialLine | localized | optional | metaobject `product_detail_copy.material_line` |
| symbolismLabel/Title/Body/Body2 | localized | optional | metaobject `product_detail_copy.symbolism_*` |
| details (materials/process/lookbook stories) | localized | optional | metaobject `product_detail_copy.details` |
| seoTitle/seoDescription | localized | when-published | native `PRODUCT.meta_title`/`meta_description` |
| optionName / optionValueLabel | localized | when-published | native `PRODUCT_OPTION` / `PRODUCT_OPTION_VALUE` |
| mediaAlt | localized | optional | native `MEDIA_IMAGE.alt` |
| mediaCaption | localized | optional | metaobject `product_detail_copy.media_caption` |
| sku, price, compareAt, currency, status, visibility, category, collections, tags, media, variants | shared | — | — |

No field targets a raw Shopify metafield today — every non-native localized
field went to a translatable `$app:` metaobject once Task 16 built the real
adapter, since Shopify metafield *translation* support is native-owner-only
and narrower than the metaobject path this app actually implements. The
`metafield` target kind still exists in `ShopifyFieldTarget`'s type for a
future case that needs it, but nothing constructs one right now.

## Collection

| Key | Mode | Required | Shopify target |
|---|---|---|---|
| name | localized | always | native `COLLECTION.title` |
| localizedHandle | localized | optional | native `COLLECTION.handle` (Task 23) |
| subtitle | localized | optional | metaobject `collection_section_copy.subtitle` |
| description | localized | when-published | native `COLLECTION.body_html` |
| manifesto | localized | optional | metaobject `collection_section_copy.manifesto` |
| symbolismLabel/Title/Body/Body2 | localized | optional | metaobject `collection_section_copy.symbolism_*` |
| searchSummary | localized | optional | metaobject `collection_section_copy.search_summary` |
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
| localizedHandle | localized | optional | native `PAGE.handle` (Task 23) |
| body | localized | when-published | native `PAGE.body_html` |
| excerpt, eyebrow, ctaLabel, calloutEyebrow/Heading/CtaHref, quote, secondaryTitle/Body, archive/The Edit/material/manifesto/final-cta section copy (incl. secondary CTA label/href), materialLexicon, legalIntro, legalLastUpdated, legalSections | localized | optional (see code for exceptions) | metaobject `page_section_copy.*` |
| seoTitle/seoDescription | localized | when-published | native `PAGE.meta_title`/`meta_description` |
| slug, template, status, visibility, heroImage, ctaHref, finalCtaHref, finalContactEmail, editProductIds, finalCtaProductIds, section enabled flags | shared | — | — |

Flat legal policy pages that match a Shopify `SHOP_POLICY` (Privacy, Terms)
sync `body`/`title` there instead of `PAGE` — resolved per-page in Task 16,
not in the registry itself (the registry only fixes the *field*, not which
native resource a given page instance binds to).

## Storefront copy

Derived programmatically from `STOREFRONT_COPY_KEYS`
(`lib/content/storefront-copy-fields.ts`) so the two lists cannot drift.
Keys target metaobject `storefront_copy.<key>` — chrome, footer, contact CTA, and cookie consent / settings copy.
Header main links live in `SiteSetting` `header-nav-v1` (also the footer
Navigation column). Footer service / legal / socials live in `footer-links-v1`.
Contact emails live in `footer-contact-v1`. None of those link lists are part of
this registry (no Shopify `MENU`/`LINK` binding in this app).

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
- URL/slug/handle is **no longer out of scope** — Task 23 (2026-09-19) added
  an optional `localizedHandle` field to Product, Collection, and Page (see
  their tables above), synced via Shopify's native `handle` translation and
  resolved on the storefront through `lib/content/handle-localization.ts`
  with a redirect record on change (`lib/content/handle-redirects.ts`). The
  base `slug`/`code` columns stay `shared`; only the optional per-locale
  override is localized.
