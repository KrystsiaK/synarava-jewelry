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
| shortDescription | localized | always | metaobject `product_detail_copy.short_description` |
| description | localized | always | native `PRODUCT.body_html` |
| materialLine | localized | optional | metaobject `product_detail_copy.material_line` |
| symbolismLabel/Title/Body/Body2 | localized | optional | metaobject `product_detail_copy.symbolism_*` |
| details (materials/process/lookbook stories) | localized | optional | metaobject `product_detail_copy.details` |
| seoTitle/seoDescription | localized | when-published | native `PRODUCT.meta_title`/`meta_description` |
| optionName / optionValueLabel | localized | when-published | native `PRODUCT_OPTION` / `PRODUCT_OPTION_VALUE` |
| mediaAlt | localized | optional (EN publish checklist via Issues / Meta Health) | native `MEDIA_IMAGE.alt` |
| mediaCaption | localized | optional | metaobject `product_detail_copy.media_caption` |
| slug | shared | always | — (one path for every locale; commerce `productSet` maps to `PRODUCT.handle`) |
| sku, price, compareAt, currency, status, visibility, category, collections, tags, media, variants | shared | — | — |
| merchant product metafield text (`custom.*` etc., Fields tab) | localized | optional | metafield `value` via Translations API on Metafield GID |
| merchant product metafield non-text (number/boolean/date/url/json) | shared | optional | metafieldsSet (EN only) |

Structured Synarava CMS copy still uses `$app:` metaobjects (Task 16). Merchant
**Fields** tab text metafields (e.g. Care instructions) use Shopify Metafield
translations (`translationsRegister` / `key: value`) so each locale can differ.
Overlays live in `workingSnapshot.metafieldTranslations` and are stripped from
commerce conflict compare.

Product URLs use the shared `slug` for every language (`/pt/products/{slug}`).
Per-locale product URL handles were removed from the admin — old translation
handles still resolve once, then redirect to the shared slug.

## Collection

| Key | Mode | Required | Shopify target |
|---|---|---|---|
| name | localized | always | native `COLLECTION.title` |
| localizedHandle | localized | optional | native `COLLECTION.handle` (Task 23) |
| subtitle | localized | optional | metaobject `collection_section_copy.subtitle` |
| description | localized | when-published | native `COLLECTION.body_html` |
| manifesto | localized | optional | metaobject `collection_section_copy.manifesto` |
| storyTitle | localized | optional | metaobject `collection_section_copy.story_title` |
| storyBody | localized | optional | metaobject `collection_section_copy.story_body` |
| symbolismLabel/Title/Body/Body2 | localized | optional | metaobject `collection_section_copy.symbolism_*` |
| searchSummary | localized | optional | metaobject `collection_section_copy.search_summary` |
| ctaLabel (hero primary CTA) | localized | optional | — (Synarava-only; empty → Collections page `detailShopLabel` → `messages` `collections.detail.shopProducts`) |
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
| excerpt, eyebrow, ctaLabel, calloutEyebrow/Heading/CtaHref, heroOpeningLabel/heroCountLabel/heroQualifier, detailShopLabel/detailCollectionsLabel/detailScrollLabel/detailManifesto*/detailStoryEyebrow/detailAccentCodeLabel/detailTeaser*, detailCatalogEyebrow/detailCatalogHeading, quote, secondaryTitle/Body, archive/The Edit/material/manifesto/final-cta section copy (incl. secondary CTA label/href), materialLexicon, legalIntro, legalLastUpdatedLabel, legalSections, Shop page section copy (`shopNew*`, `shopProductType*`, `shopFilter*`, `shopAvailableCountLabel`) | localized | optional (see code for exceptions) | metaobject `page_section_copy.*` |
| seoTitle/seoDescription | localized | when-published | native `PAGE.meta_title`/`meta_description` |
| slug, template, status, visibility, heroImage, ctaHref, finalCtaHref, finalContactEmail, editProductIds, finalCtaProductIds, section enabled flags, legalLastUpdated | shared | — | — |

`legalLastUpdated` is one shared display date (for example `5 September 2026`). Save copies it onto every locale row; it is not per-locale copy, and the admin does not retype it per language. The storefront formats the month from `messages/<locale>.json` (`legal.common.months`, optional `legal.common.datePattern`). `legalLastUpdatedLabel` is the per-locale label; when that field is empty the page uses `legal.common.lastUpdated`. See [Adding a new language](./translation-operations.md#adding-a-new-language).

Flat legal policy pages that match a Shopify `SHOP_POLICY` (Privacy, Terms)
sync `body`/`title` there instead of `PAGE` — resolved per-page in Task 16,
not in the registry itself (the registry only fixes the *field*, not which
native resource a given page instance binds to).

## Storefront copy

Derived programmatically from `STOREFRONT_COPY_KEYS`
(`lib/content/storefront-copy-fields.ts`) so the two lists cannot drift.
Keys target metaobject `storefront_copy.<key>` — chrome, footer, contact CTA, home Featured collections / material / final-CTA chrome (`home.archive.*`, `home.material.*`, `home.finalCta.eyebrow`), skip link / appearance (`a11y.skip`, `theme.appearance`), brand wordmark subtitle (`brand.curatedGoods`), cookie consent / settings copy, and the leave-a-review form (`reviews.shareTitle`, `reviews.form.*`).
Header cart and account labels, the cart page, the add-to-cart confirmation, and `/login`
are **not** in this registry. They are local overrides in `SiteSetting` `commerce-copy-v1`
(`lib/content/commerce-copy-fields.ts`). Shopify hosts checkout, payment, and the
customer-account code screen, so those strings are not pushed to `$app:storefront_copy`.
Header main links live in `SiteSetting` `header-nav-v1` (also the footer
Navigation column). Footer service / legal / socials live in `footer-links-v1`.
Contact emails live in `footer-contact-v1`. None of those link lists are part of
this registry (no Shopify `MENU`/`LINK` binding in this app).

## Taxonomy (merchant-owned labels only)

Shopify's Standard Product Taxonomy EN identity (`shopifyCategoryId` /
`shopifyCategoryName` leaf) and product `productType` remain Shopify commerce
SoT — never invent a parallel taxonomy tree in Synarava.

**Buyer-facing display overlays** for distinct EN category leaves and product
types live in `TaxonomyValueLabel` and are edited at **Admin → Shared → Taxonomy**
(`/admin/settings#shared-taxonomy`). One row per `(kind, enValue, locale)`.

| Surface | Shopify Translations API | Synarava overlay |
|---|---|---|
| Category leaf (SPT) | Not available (`TaxonomyCategory` ∉ TranslatableResourceType) | Primary path for RU/PT display |
| Product type | `PRODUCT` field `product_type` — **pull** into shared overlay when present | Fills gaps; **no push** of shared overlays |

Legacy registry rows below describe optional merchant-owned `taxonomy_label`
metaobject fields (not the SPT leaf / productType facet path above):

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
- URL/slug/handle: **Product** uses one shared `slug` for every language (admin
  no longer exposes per-locale URL handles). **Collection** and **Page** still
  have an optional `localizedHandle` (Task 23) synced via Shopify's native
  `handle` translation and resolved through `lib/content/handle-localization.ts`
  with a redirect record on change (`lib/content/handle-redirects.ts`). Their
  base `slug`/`code` columns stay `shared`.
